import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

/*
 * A month whose content was removed after its retention period (S-901). The server's clock cannot
 * be set from here, so the API's answer is the one the server gives for such a month
 * (apps/server/src/routes/aussonderung.test.ts proves the server's side).
 */

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

const ABGESCHLOSSEN = Date.parse("2026-11-20T09:00:00+01:00");
const AUSGESONDERT = Date.parse("2029-01-01T00:00:00+01:00");

test("the check page calls a Prüfwert of a removed month genuine and says its content is gone @phone", async ({
  page,
}) => {
  await page.route("**/api/v1/pruefen", (route) =>
    route.fulfill({
      json: {
        ergebnis: "ausgesondert",
        monat: "2026-10",
        abgeschlossenAm: ABGESCHLOSSEN,
        ausgesondertAm: AUSGESONDERT,
        jahre: 2,
        betrieb: "Weber Haustechnik",
      },
    }),
  );
  await page.goto("/pruefen?betrieb=weber");
  await page.getByLabel(t("pruefen_wert")).fill(`Nr. 12 · ${"a".repeat(64)}`);
  await page.getByRole("button", { name: t("pruefen_knopf") }).click();
  const status = page.getByRole("status");
  await expect(status).toContainText(t("pruefen_ausgesondert"));
  await expect(status).toContainText("Oktober 2026 bei Weber Haustechnik");
  await expect(status).toContainText("von 2 Jahren");
});

test("the month view of a removed month shows only that it was removed @phone", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.route("**/api/v1/arbeitszeit/monat?**", async (route) => {
    const antwort = await route.fetch();
    const ansicht = await antwort.json();
    await route.fulfill({
      response: antwort,
      json: {
        ...ansicht,
        vorbei: true,
        abschluss: null,
        bestaetigung: null,
        ausgesondert: { am: AUSGESONDERT, abgeschlossenAm: ABGESCHLOSSEN, jahre: 2 },
      },
    });
  });
  await page.goto("/monat");
  await expect(page.getByText(/^Inhalt entfernt am /)).toBeVisible();
  await expect(page.getByText(/Aufbewahrungsfrist von 2 Jahren/)).toBeVisible();
  await expect(page.getByRole("table", { name: t("monat_tage") })).toHaveCount(0);
  await expect(page.getByRole("link", { name: t("monat_stundenzettel") })).toHaveCount(0);
  await expect(page.getByRole("button", { name: t("monat_bestaetigen") })).toHaveCount(0);
  await expect(page.getByRole("button", { name: t("monat_abschliessen") })).toHaveCount(0);
});
