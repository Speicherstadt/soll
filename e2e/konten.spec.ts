import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { senden, weberMitSandra } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;
/** The fixed part of a text before its first placeholder */
const anfang = (key: string) => t(key).split("{")[0] ?? "";

const ABW = "/api/v1/arbeitszeit/abwesenheiten";

/** A day some days ahead in Berlin, as YYYY-MM-DD */
const inTagen = (tage: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(
    Date.now() + tage * 86_400_000,
  );

/**
 * axe in both themes; each loaded afresh in its theme, as e2e/accessibility.spec.ts does, so no
 * transition of the colours from the theme before is measured half way
 */
const axe = async (page: Page) => {
  for (const farbe of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: farbe });
    await page.reload();
    await expect(page.getByRole("region", { name: t("konten_titel") })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const ergebnis = await new AxeBuilder({ page }).analyze();
    expect(ergebnis.violations, farbe).toEqual([]);
  }
};

test("the owner records the notice on leave expiring and a start balance; Sandra sees both @phone", async ({
  page,
  browser,
}) => {
  const { jonas } = await weberMitSandra(page, browser, test.info());
  await jonas.goto("/abwesenheiten");
  const konten = jonas.getByRole("region", { name: t("konten_titel") });
  await konten.getByLabel(t("konten_person")).selectOption({ label: "Sandra Kühn" });
  // no notice yet: it is due (§ 7 Abs. 3 BUrlG; BAG 9 AZR 541/15)
  await expect(konten).toContainText("Hinweis auf Verfall fällig bis");

  await konten.getByRole("button", { name: t("konten_hinweis_geben") }).click();
  const hinweis = jonas.getByRole("dialog", { name: t("konten_hinweis_titel") });
  await expect(hinweis).toContainText("§ 7 Abs. 3 BUrlG");
  await hinweis.getByRole("button", { name: t("konten_hinweis_speichern") }).click();
  await expect(hinweis).toBeHidden();
  await expect(jonas.getByRole("status")).toHaveText(t("konten_hinweis_gespeichert"));
  await expect(konten).toContainText(", verfällt mit dem ");
  await expect(konten).toContainText(t("konten_hinweise_titel"));

  await konten.getByRole("button", { name: t("konten_anpassen") }).click();
  const anpassen = jonas.getByRole("dialog", { name: t("konten_anpassen") });
  await anpassen.getByLabel(t("konten_stunden")).fill("7:30");
  await anpassen.getByLabel(t("korrektur_grund")).fill("Übernahme aus der Liste");
  await anpassen.getByRole("button", { name: t("konten_anpassung_speichern") }).click();
  await expect(anpassen).toBeHidden();
  await expect(konten.getByRole("definition").nth(1)).toHaveText("+7:30");
  await expect(konten).toContainText("Übernahme aus der Liste");

  // Sandra sees her accounts, the notice with its day and the change by hand; no one else's
  await page.goto("/abwesenheiten");
  const eigene = page.getByRole("region", { name: t("konten_titel") });
  await expect(eigene.getByRole("definition").nth(1)).toHaveText("+7:30");
  await expect(eigene).toContainText(anfang("konten_hinweis_zeile").trim());
  await expect(eigene).toContainText(", verfällt mit dem ");
  await expect(eigene.getByLabel(t("konten_person"))).toHaveCount(0);
  await expect(eigene.getByRole("button", { name: t("konten_hinweis_geben") })).toHaveCount(0);
  await axe(page);
});

test("Sandra sees apart what a notice lets expire and the leave no notice named yet @phone", async ({
  page,
  browser,
}) => {
  const { jonas, nutzerId } = await weberMitSandra(page, browser, test.info());
  const heute = inTagen(0);
  const pfad = `/api/v1/arbeitszeit/konten/${nutzerId}`;
  await senden(jonas, "POST", `${pfad}/hinweise`, { tag: heute });
  // one more day of this year after the notice: no notice names it (review S-708)
  await senden(jonas, "POST", `${pfad}/anpassungen`, {
    art: "urlaub_korrektur",
    jahr: Number(heute.slice(0, 4)),
    halbtage: 2,
    grund: "Tag aus dem Vorjahr nachgetragen",
  });
  await page.goto("/abwesenheiten");
  const konten = page.getByRole("region", { name: t("konten_titel") });
  const zeilen = konten.getByRole("listitem");
  await expect(zeilen.filter({ hasText: ", verfällt mit dem " })).toHaveCount(1);
  const faellig = zeilen.filter({ hasText: "Hinweis auf Verfall fällig bis" });
  await expect(faellig).toHaveCount(1);
  await expect(faellig).toContainText(`${t("abw_tag_eins")}.`);
  await axe(page);
});

test("the team calendar of a site: its holidays, and Sandra's leave only as „abwesend“", async ({
  page,
  browser,
}) => {
  const { jonas } = await weberMitSandra(page, browser, test.info());
  await senden(jonas, "POST", "/api/v1/standorte", { name: "Werkstatt", land: "HH" });
  await senden(jonas, "POST", "/api/v1/standorte", {
    name: "Baustelle Augsburg",
    land: "BY",
    regionen: ["augsburg"],
  });
  const { abwesenheitId } = await senden(page, "POST", `${ABW}/antrag`, {
    art: "urlaub",
    von: inTagen(7),
    bis: inTagen(8),
  });
  await senden(jonas, "POST", `${ABW}/${abwesenheitId}/freigeben`, {});

  await jonas.goto("/abwesenheiten");
  const team = jonas.getByRole("region", { name: t("abw_team_titel") });
  await expect(team.getByLabel(t("abw_team_standort"))).toHaveValue(/.+/);
  const zeile = team.getByRole("row", { name: /Sandra Kühn/ });
  await expect(zeile).toContainText(t("abw_art_abwesend"));
  await expect(zeile).not.toContainText(t("abw_art_urlaub"));
  await expect(team).toContainText(`Sandra Kühn · ${t("abw_art_abwesend")}`);

  // the holidays of the site: four weeks on until one comes (Hamburg has one at least every four months)
  const feiertage = team.getByText(anfang("abw_team_feiertage"));
  for (let schritt = 0; schritt < 5 && !(await feiertage.isVisible()); schritt += 1) {
    await team.getByRole("button", { name: t("abw_team_vor") }).click();
    await jonas.waitForLoadState("networkidle");
  }
  await expect(feiertage).toBeVisible();
  await team.getByLabel(t("abw_team_standort")).selectOption({ label: "Baustelle Augsburg" });
  await expect(team.getByLabel(t("abw_team_standort"))).toHaveValue(/.+/);
  await axe(jonas);
});
