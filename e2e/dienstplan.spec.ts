import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, senden, zweiterBrowser } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { planAktion } from "./plan.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string | number> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, String(wert)),
    de[key] ?? key,
  );

/** The Monday of this week in Berlin, and the days after it: the week the plan opens with */
const wochentag = (index: number) => {
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(Date.now());
  const mittag = new Date(`${heute}T12:00:00Z`);
  const montag = mittag.getTime() - ((mittag.getUTCDay() + 6) % 7) * 86_400_000;
  return new Date(montag + index * 86_400_000).toISOString().slice(0, 10);
};

/**
 * Café Elbblick as the owner plans it: its site, the template "Spät" for the service, a need of two
 * people on Monday afternoons, and Tom, who works in shifts, in his own browser
 */
const elbblick = async (jonas: Page, browser: Browser) => {
  await betriebAnlegen(jonas);
  await senden(jonas, "POST", "/api/v1/standorte", { name: "Elbe", land: "HH" });
  const tom = await zweiterBrowser(browser, test.info());
  const tomId = await einladungAnnehmen(jonas, tom, "Tom Berger");
  const { nutzerId: jonasId } = (await (await jonas.request.get("/api/v1/betrieb")).json()) as {
    nutzerId: string;
  };
  const { standorte } = (await (await jonas.request.get("/api/v1/standorte")).json()) as {
    standorte: { standortId: string }[];
  };
  const standortId = standorte[0]?.standortId ?? "";
  await senden(jonas, "POST", "/api/v1/dienstplan/vorlagen", {
    name: "Spät",
    beginnMinute: 14 * 60,
    endeMinute: 22 * 60,
    pauseMinuten: 30,
    rolle: "Service",
  });
  await senden(jonas, "POST", "/api/v1/dienstplan/bedarf", {
    standortId,
    rolle: "Service",
    wochentag: 1,
    beginnMinute: 14 * 60,
    endeMinute: 22 * 60,
    anzahl: 2,
  });
  return { tom, tomId, jonasId, standortId };
};

const zelle = (page: Page, nutzerId: string | null, tag: string) =>
  page.locator(`[data-zelle="${nutzerId ?? "offen"}:${tag}"]`);
const deckung = (page: Page) => page.getByRole("region", { name: /^Bedarf der Woche/ });

test("plans a week from templates by drag and drop and by keyboard, against the need", async ({
  page,
  browser,
}) => {
  const { tomId, jonasId } = await elbblick(page, browser);
  await page.goto("/dienstplan");
  await expect(page.getByRole("table", { name: t("plan_tabelle") })).toBeVisible();
  await expect(page.getByText(/^KW \d+ · /)).toBeVisible();
  await expect(deckung(page)).toContainText(t("plan_deckung_fehlt", { anzahl: 2 }));

  // a template dragged onto Tom's Monday plans the shift there, a draft
  const vorlage = page.locator("[data-vorlage]").filter({ hasText: "Spät" });
  await vorlage.dragTo(zelle(page, tomId, wochentag(0)));
  await expect(zelle(page, tomId, wochentag(0))).toContainText("14:00–22:00");
  await expect(zelle(page, tomId, wochentag(0))).toContainText("Spät · Service");
  await expect(page.getByText(/ · Entwurf$/)).toBeVisible();
  await expect(deckung(page)).toContainText(t("plan_deckung_fehlt", { anzahl: 1 }));
  await vorlage.dragTo(zelle(page, jonasId, wochentag(0)));
  await expect(deckung(page)).toContainText(t("plan_deckung_gedeckt"));

  // Tom's shift picked up at its handle and moved a day on with the keyboard
  const griff = zelle(page, tomId, wochentag(0)).getByRole("button", { name: /verschieben/ });
  await griff.press("Enter");
  await expect(griff).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText(/^Ziel: Tom Berger, Dienstag/)).toBeAttached();
  await page.keyboard.press("Enter");
  await expect(zelle(page, tomId, wochentag(1))).toContainText("14:00–22:00");
  await expect(zelle(page, tomId, wochentag(0))).not.toContainText("14:00");
  await expect(deckung(page)).toContainText(t("plan_deckung_fehlt", { anzahl: 1 }));

  // dragged by the mouse into the row of open shifts on Wednesday
  await zelle(page, tomId, wochentag(1))
    .locator("button[draggable]")
    .dragTo(zelle(page, null, wochentag(2)));
  await expect(zelle(page, null, wochentag(2))).toContainText("14:00–22:00");
  await expect(zelle(page, tomId, wochentag(1))).not.toContainText("14:00");
});

test("edits and removes a shift, and manages templates and need in their dialogs", async ({
  page,
  browser,
}) => {
  const { tomId } = await elbblick(page, browser);
  await page.goto("/dienstplan");
  await zelle(page, tomId, wochentag(3))
    .getByRole("button", {
      name: new RegExp(`^${t("plan_hinzufuegen_fuer", { ort: "Tom Berger" })}`),
    })
    .click();
  const dialog = page.getByRole("dialog", { name: t("plan_hinzufuegen") });
  await dialog.getByLabel(t("plan_vorlage")).selectOption({ label: "Spät" });
  await dialog.getByLabel(t("plan_ende")).fill("23:30");
  await dialog.getByRole("button", { name: t("plan_speichern") }).click();
  await expect(dialog).toBeHidden();
  await expect(zelle(page, tomId, wochentag(3))).toContainText("14:00–23:30");

  await zelle(page, tomId, wochentag(3)).locator("button[draggable]").click();
  const bearbeiten = page.getByRole("dialog", { name: t("plan_bearbeiten") });
  await bearbeiten.getByRole("button", { name: t("plan_entfernen") }).click();
  await expect(bearbeiten).toBeHidden();
  await expect(zelle(page, tomId, wochentag(3))).not.toContainText("14:00");

  await page.getByRole("button", { name: t("plan_vorlagen"), exact: true }).click();
  const vorlagen = page.getByRole("dialog", { name: t("plan_vorlagen") });
  await vorlagen.getByLabel(t("plan_vorlage_name")).fill("Früh");
  await vorlagen.getByLabel(t("plan_rolle")).fill("Theke");
  await vorlagen.getByLabel(t("plan_beginn")).fill("07:00");
  await vorlagen.getByLabel(t("plan_ende")).fill("15:00");
  await vorlagen.getByRole("button", { name: t("plan_vorlage_neu") }).click();
  await expect(vorlagen.getByRole("listitem").filter({ hasText: "Früh" })).toContainText(
    "07:00–15:00",
  );
  await vorlagen
    .getByRole("button", { name: t("plan_vorlage_entfernen", { name: "Spät" }) })
    .click();
  await expect(vorlagen.getByRole("listitem")).toHaveCount(1);
  await vorlagen.getByRole("button", { name: t("plan_schliessen") }).click();

  await page.getByRole("button", { name: t("plan_bedarf"), exact: true }).click();
  const bedarf = page.getByRole("dialog", { name: t("plan_bedarf_titel") });
  await bedarf.getByLabel(t("plan_wochentag")).selectOption({ label: "Samstag" });
  await bedarf.getByLabel(t("plan_rolle")).fill("Theke");
  await bedarf.getByRole("button", { name: t("plan_bedarf_neu") }).click();
  await expect(bedarf.getByRole("listitem").filter({ hasText: "Samstag" })).toContainText("Theke");
  await bedarf.getByRole("button", { name: t("plan_schliessen") }).click();
  await expect(deckung(page)).toContainText("Theke");
});

test("plans one day at a time on a phone @phone", async ({ page, browser }) => {
  const { tom } = await elbblick(page, browser);
  // the width of a phone also in the desktop project: below md the plan shows one day
  await page.setViewportSize({ width: 412, height: 839 });
  await page.goto("/dienstplan");
  await expect(page.getByRole("table", { name: t("plan_tabelle") })).toBeHidden();
  const dienstag = page
    .getByRole("group", { name: t("plan_tag") })
    .getByRole("button")
    .nth(1);
  await dienstag.click();
  await expect(dienstag).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(t("plan_tag_leer"))).toBeVisible();
  await page.getByRole("button", { name: t("plan_hinzufuegen"), exact: true }).click();
  const dialog = page.getByRole("dialog", { name: t("plan_hinzufuegen") });
  await expect(dialog.getByLabel(t("plan_tag"))).toHaveValue(wochentag(1));
  await dialog.getByLabel(t("plan_vorlage")).selectOption({ label: "Spät" });
  await dialog.getByLabel(t("plan_person")).selectOption({ label: "Tom Berger" });
  await dialog.getByRole("button", { name: t("plan_speichern") }).click();
  await expect(dialog).toBeHidden();
  const eintrag = page.getByRole("button", { name: /Tom Berger.*14:00–22:00/ });
  await expect(eintrag).toBeVisible();

  // moved to Thursday in its dialog: Tuesday is empty again, Thursday has it
  await eintrag.click();
  const bearbeiten = page.getByRole("dialog", { name: t("plan_bearbeiten") });
  await bearbeiten.getByLabel(t("plan_tag")).fill(wochentag(3));
  await bearbeiten.getByRole("button", { name: t("plan_speichern") }).click();
  await expect(page.getByText(t("plan_tag_leer"))).toBeVisible();
  await page
    .getByRole("group", { name: t("plan_tag") })
    .getByRole("button")
    .nth(3)
    .click();
  await expect(page.getByRole("button", { name: /Tom Berger.*14:00–22:00/ })).toBeVisible();

  // Tom sees nothing of the draft, not even on his phone
  await tom.goto("/dienstplan");
  await expect(tom.getByText(t("plan_nichts_veroeffentlicht"))).toBeVisible();
  await expect(tom.getByText("14:00–22:00")).toHaveCount(0);
  await expect(tom.getByRole("button", { name: t("plan_vorlagen") })).toHaveCount(0);
});

test("employees see nothing unpublished and cannot plan @phone", async ({ page, browser }) => {
  const { tom, tomId, standortId } = await elbblick(page, browser);
  await senden(page, "POST", "/api/v1/dienstplan/schichten", {
    standortId,
    tag: wochentag(0),
    beginnMinute: 14 * 60,
    endeMinute: 22 * 60,
    pauseMinuten: 30,
    rolle: "Service",
    nutzerId: tomId,
  });
  await tom.goto("/dienstplan");
  await expect(tom.getByText(t("plan_nichts_veroeffentlicht"))).toBeVisible();
  await expect(tom.getByText("14:00–22:00")).toHaveCount(0);
  await expect(tom.getByRole("region", { name: /^Bedarf der Woche/ })).toHaveCount(0);
  const antwort = await tom.request.get("/api/v1/dienstplan/vorlagen");
  expect(antwort.status()).toBe(403);
});

for (const theme of ["light", "dark"] as const) {
  test(`axe finds nothing on a planned week and its dialogs in ${theme} @phone`, async ({
    page,
    browser,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    const { tomId, standortId } = await elbblick(page, browser);
    for (const [nutzerId, tag] of [
      [tomId, wochentag(0)],
      [null, wochentag(2)],
    ] as const)
      await senden(page, "POST", "/api/v1/dienstplan/schichten", {
        standortId,
        tag,
        beginnMinute: 22 * 60,
        endeMinute: 6 * 60,
        pauseMinuten: 30,
        rolle: "Service",
        nutzerId,
      });
    await page.goto("/dienstplan");
    await expect(deckung(page)).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await planAktion(page, t("plan_bedarf"));
    await expect(page.getByRole("dialog").getByRole("listitem")).toHaveCount(1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
