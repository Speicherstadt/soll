import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema } from "./thema.ts";

/*
 * Toggl Track API fetch and Clockify CSV export in solo mode (BAULISTE.md S-707):
 * fetches Toggl from the stand-in (apps/server/src/zeiterfasser-ersatz-dienst.ts), maps Lina
 * Petersen and "ohne Tätigkeit", runs dry run and takes over, then uploads Clockify CSV and shows
 * that the second run creates nothing new; axe green in light and dark.
 */

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

const TOGGL_CSV = resolve(
  import.meta.dirname,
  "../packages/import/src/zeiterfasser/fixtures/toggl-detailed.csv",
);
const CLOCKIFY_CSV = resolve(
  import.meta.dirname,
  "../packages/import/src/zeiterfasser/fixtures/clockify-detailed.csv",
);

const axe = async (page: Page) => {
  for (const farben of ["light", "dark"] as const) {
    await thema(page, farben);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
};

const weiter = (page: Page) =>
  page.getByRole("button", { name: t("einrichtung_weiter"), exact: true }).click();

const zahlen = (page: Page, art: string) =>
  page.getByRole("row", { name: new RegExp(`^${art}\\b`) }).getByRole("cell");

const soloModus = async (page: Page) => {
  await betriebAnlegen(page);
  await page.goto("/einstellungen");
  await page.evaluate(async () => {
    await fetch("/api/v1/betrieb/module", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projektzeit: true }),
    });
    await fetch("/api/v1/betrieb/module", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arbeitszeit: false }),
    });
  });
};

test("solo business imports from Toggl API and Toggl CSV without duplicates", async ({ page }) => {
  await soloModus(page);
  await page.goto("/umzug");
  await page.getByRole("radio", { name: "Toggl Track" }).check();
  await expect(page.getByText(t("umzug_anleitung_toggl"))).toBeVisible();
  await weiter(page);

  await page.getByRole("radio", { name: t("umzug_weg_api") }).check();
  await page.getByLabel(t("umzug_abruf_token")).fill("toggl-e2e");
  await axe(page);
  await page.getByRole("button", { name: t("umzug_abruf_los") }).click();
  await expect(page.getByText(`Zeile 19: ${t("umzug_lese_laeuft_noch")}`)).toBeVisible();
  await expect(page.getByLabel(t("umzug_abruf_token"))).toHaveValue("");
  await weiter(page);

  await page.getByLabel("Lina Petersen").selectOption({ label: "Jonas Weber" });
  await page.getByLabel(t("umzug_ohne_taetigkeit")).selectOption({ index: 1 });
  await axe(page);
  await weiter(page);
  await weiter(page);

  await page.getByRole("button", { name: t("umzug_probelauf") }).click();
  await expect(zahlen(page, t("umzug_art_kunden"))).toHaveText([
    t("umzug_art_kunden"),
    "4",
    "0",
    "0",
    "0",
  ]);
  await expect(zahlen(page, t("umzug_art_buchungen"))).toHaveText([
    t("umzug_art_buchungen"),
    "4",
    "0",
    "1",
    "0",
  ]);
  await axe(page);
  await page.getByRole("button", { name: t("umzug_uebernehmen"), exact: true }).click();
  await expect(
    page.getByText(/^Übernommen\. Die Originaldatei liegt unter ihrem SHA-256 [0-9a-f]{64}\.$/),
  ).toBeVisible();

  // Second run with Toggl CSV export: all 4 taken-over bookings are recognised as already there
  await page.getByRole("button", { name: t("umzug_neu_beginnen") }).click();
  await page.getByRole("radio", { name: "Toggl Track" }).check();
  await weiter(page);

  await page.getByRole("radio", { name: t("umzug_weg_datei") }).check();
  await page.getByLabel(t("umzug_datei_waehlen")).setInputFiles(TOGGL_CSV);
  await expect(page.getByRole("status")).toContainText("2");
  await weiter(page);

  await page.getByLabel("Lina Petersen").selectOption({ label: "Jonas Weber" });
  await page.getByLabel(t("umzug_ohne_taetigkeit")).selectOption({ index: 1 });
  await weiter(page);
  await weiter(page);

  await page.getByRole("button", { name: t("umzug_probelauf") }).click();
  await expect(zahlen(page, t("umzug_art_buchungen"))).toHaveText([
    t("umzug_art_buchungen"),
    "0",
    "4",
    "1",
    "0",
  ]);
});

test("solo business imports from Clockify CSV and Clockify API without duplicates", async ({
  page,
}) => {
  await soloModus(page);
  await page.goto("/umzug");
  await page.getByRole("radio", { name: "Clockify" }).check();
  await expect(page.getByText(t("umzug_anleitung_clockify"))).toBeVisible();
  await weiter(page);

  await page.getByLabel(t("umzug_datei_waehlen")).setInputFiles(CLOCKIFY_CSV);
  await expect(page.getByRole("status")).toContainText("2");
  await weiter(page);

  await page.getByLabel("Lina Petersen").selectOption({ label: "Jonas Weber" });
  await page.getByLabel(t("umzug_ohne_taetigkeit")).selectOption({ index: 1 });
  await weiter(page);
  await weiter(page);

  await page.getByRole("button", { name: t("umzug_probelauf") }).click();
  await expect(zahlen(page, t("umzug_art_buchungen"))).toHaveText([
    t("umzug_art_buchungen"),
    "4",
    "0",
    "1",
    "0",
  ]);
  await page.getByRole("button", { name: t("umzug_uebernehmen"), exact: true }).click();
  await expect(
    page.getByText(/^Übernommen\. Die Originaldatei liegt unter ihrem SHA-256 [0-9a-f]{64}\.$/),
  ).toBeVisible();

  await page.getByRole("button", { name: t("umzug_neu_beginnen") }).click();
  await page.getByRole("radio", { name: "Clockify" }).check();
  await weiter(page);

  await page.getByRole("radio", { name: t("umzug_weg_api") }).check();
  await page.getByLabel(t("umzug_abruf_schluessel")).fill("clockify-e2e");
  await axe(page);
  await page.getByRole("button", { name: t("umzug_abruf_los") }).click();
  await expect(page.getByText(`Zeile 16: ${t("umzug_lese_laeuft_noch")}`)).toBeVisible();
  await expect(page.getByLabel(t("umzug_abruf_schluessel"))).toHaveValue("");
  await weiter(page);

  await page.getByLabel("Lina Petersen").selectOption({ label: "Jonas Weber" });
  await page.getByLabel(t("umzug_ohne_taetigkeit")).selectOption({ index: 1 });
  await weiter(page);
  await weiter(page);

  await page.getByRole("button", { name: t("umzug_probelauf") }).click();
  await expect(zahlen(page, t("umzug_art_buchungen"))).toHaveText([
    t("umzug_art_buchungen"),
    "0",
    "4",
    "1",
    "0",
  ]);
});
