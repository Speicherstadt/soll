import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, senden, zweiterBrowser } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

/** The month before this one in Berlin: the month a person closes next */
const vormonat = () => {
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(Date.now());
  const [jahr, monat] = heute.split("-").map(Number) as [number, number];
  return monat === 1 ? `${jahr - 1}-12` : `${jahr}-${String(monat - 1).padStart(2, "0")}`;
};

/**
 * Weber Haustechnik with Sandra, who worked 8:00 on the 6th of last month with half an hour's
 * break, added by the owner with a reason
 */
const weberMitMonat = async (sandra: Page, browser: Parameters<typeof zweiterBrowser>[0]) => {
  const jonas = await zweiterBrowser(browser, test.info());
  const { betriebId } = await betriebAnlegen(jonas);
  const nutzerId = await einladungAnnehmen(jonas, sandra, "Sandra Kühn");
  const modell = await senden(jonas, "POST", "/api/v1/arbeitszeit/modelle", {
    name: "Vollzeit",
    sollMinuten: [480, 480, 480, 480, 480, 0, 0],
    lohnArt: "monat",
    lohnCent: null,
    minijob: false,
    gueltigAb: "2026-01-01",
  });
  const monat = vormonat();
  await senden(jonas, "PUT", `/api/v1/arbeitszeit/personen/${nutzerId}/modell`, {
    modellId: modell.modellId,
    gueltigAb: `${monat}-01`,
  });
  for (const [art, uhrzeit] of [
    ["kommen", "08:00"],
    ["pause_beginn", "12:00"],
    ["pause_ende", "12:30"],
    ["gehen", "16:30"],
  ] as const) {
    // in UTC: on the 6th the clocks never change, so the day keeps its 8:00 of work in Berlin
    const zeitpunkt = Date.parse(`${monat}-06T${uhrzeit}:00Z`);
    await senden(jonas, "POST", "/api/v1/arbeitszeit/stempelungen/nachtrag", {
      nutzerId,
      art,
      zeitpunkt,
      grund: "Stundenzettel auf Papier",
    });
  }
  return { jonas, betriebId };
};

test("the person confirms the month, the owner closes it, the Prüfwert checks out @phone", async ({
  page,
  browser,
}) => {
  const { jonas, betriebId } = await weberMitMonat(page, browser);

  await page.goto("/monat");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sandra Kühn");
  await expect(page.getByRole("table", { name: t("monat_tage") })).toContainText("8:00");
  await expect(page.getByText(t("monat_geaendert")).first()).toBeVisible();
  await expect(page.getByRole("button", { name: t("monat_abschliessen") })).toHaveCount(0);
  await page.getByRole("button", { name: t("monat_bestaetigen") }).click();
  await expect(page.getByText(/^Sandra Kühn hat bestätigt, /)).toBeVisible();
  await expect(page.getByRole("button", { name: t("monat_bestaetigen") })).toHaveCount(0);

  await jonas.goto("/zeiten");
  await jonas.getByRole("link", { name: t("monat_titel") }).click();
  await expect(jonas).toHaveURL("/monat");
  await jonas.getByLabel(t("zeiten_person")).selectOption({ label: "Sandra Kühn" });
  await expect(jonas.getByText(/^Sandra Kühn hat bestätigt, /)).toBeVisible();
  await jonas.getByRole("button", { name: t("monat_abschliessen") }).click();
  await expect(jonas.getByText(/^Abgeschlossen von Jonas Weber, /)).toBeVisible();
  await expect(jonas.getByRole("status")).toHaveText(t("monat_mail_nicht_eingerichtet"));
  const pruefwert = (await jonas.getByTestId("pruefwert").textContent()) ?? "";
  expect(pruefwert).toMatch(/^Nr\. \d+ · [0-9a-f]{64}$/);

  // Sandra sees the same Prüfwert, downloads her sheet and checks it on the open check page
  await page.reload();
  await expect(page.getByTestId("pruefwert")).toHaveText(pruefwert);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: t("monat_stundenzettel") }).click();
  expect((await download).suggestedFilename()).toBe(`stundenzettel-${vormonat()}.pdf`);
  await page.getByRole("link", { name: t("monat_zur_pruefseite") }).click();
  await expect(page).toHaveURL(`/pruefen?betrieb=${betriebId}`);
  await page.getByLabel(t("pruefen_wert")).fill(pruefwert);
  await page.getByRole("button", { name: t("pruefen_knopf") }).click();
  await expect(page.getByRole("status")).toContainText(t("pruefen_ok"));
  await expect(page.getByRole("status")).toContainText("Sandra Kühn bei Weber Haustechnik");

  // one digit off is no longer this sheet's Prüfwert
  const falsch = pruefwert.replace(/[0-9a-f]$/, (zeichen) => (zeichen === "0" ? "1" : "0"));
  await page.getByLabel(t("pruefen_wert")).fill(falsch);
  await page.getByRole("button", { name: t("pruefen_knopf") }).click();
  await expect(page.getByRole("status")).toContainText(t("pruefen_abweichung"));
});

test("the owner closes without confirmation only with a reason, then the month is locked", async ({
  page,
  browser,
}) => {
  const { jonas } = await weberMitMonat(page, browser);
  await jonas.goto("/monat");
  await jonas.getByLabel(t("zeiten_person")).selectOption({ label: "Sandra Kühn" });
  await jonas.getByRole("button", { name: t("monat_abschliessen") }).click();
  const dialog = jonas.getByRole("dialog", { name: t("monat_ohne_titel") });
  await dialog.getByRole("button", { name: t("monat_abschliessen") }).click();
  await expect(dialog.getByRole("alert")).toHaveText(t("monat_fehler_grund"));
  await dialog.getByLabel(t("korrektur_grund")).fill("Sandra ist im Urlaub");
  await dialog.getByRole("button", { name: t("monat_abschliessen") }).click();
  await expect(dialog).toBeHidden();
  await expect(jonas.getByText(/^Abgeschlossen von Jonas Weber, /)).toBeVisible();

  await page.goto("/monat");
  await expect(page.getByRole("button", { name: t("monat_bestaetigen") })).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});
