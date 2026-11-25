import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema } from "./thema.ts";

/*
 * The move from Kimai over its REST API (S-705): the owner fetches from the stand-in of a Kimai
 * instance (apps/server/src/kimai-ersatz-dienst.ts, built after Kimai's source), maps, runs the dry
 * run, takes over, and a second fetch creates nothing.
 */

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

/** The stand-in's origin, allowed in scripts/e2e-server.ts (SOLL_IMPORT_ALLOWED_ORIGINS) */
const INSTANZ = "http://127.0.0.1:28213";
const TOKEN = "kimai_e2e_4711";

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

/** Kimai chosen, the fetch filled in and sent, on to the dry run */
const abrufen = async (page: Page, pruefen = false) => {
  await page.getByRole("radio", { name: "Kimai" }).check();
  await expect(page.getByText(t("umzug_anleitung_kimai"))).toBeVisible();
  await weiter(page);
  await page.getByLabel(t("umzug_abruf_instanz")).fill(INSTANZ);
  await page.getByLabel(t("umzug_abruf_token")).fill(TOKEN);
  await page.getByLabel(t("umzug_abruf_von"), { exact: true }).fill("2026-09-01");
  await page.getByLabel(t("umzug_abruf_bis"), { exact: true }).fill("2026-09-30");
  if (pruefen) await axe(page);
  await page.getByRole("button", { name: t("umzug_abruf_los") }).click();
  // the timesheet still running is named with its line; the token is gone from the form
  await expect(page.getByText(`Zeile 15: ${t("umzug_lese_laeuft_noch")}`)).toBeVisible();
  await expect(page.getByLabel(t("umzug_abruf_token"))).toHaveValue("");
  await weiter(page);
  // Soll proposes the owner for Kimai's "Jonas Weber"; Kimai's activities are mapped like customers
  await expect(page.getByLabel("Jonas Weber")).toHaveValue(/.+/);
  await expect(page.getByRole("heading", { name: t("umzug_taetigkeiten_titel") })).toBeVisible();
  await expect(page.getByLabel("Rohinstallation")).toHaveValue("neu");
  if (pruefen) await axe(page);
  await weiter(page);
  await weiter(page);
  await page.getByRole("button", { name: t("umzug_probelauf") }).click();
};

test("the owner fetches from Kimai, takes it over, and a second fetch creates nothing", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/umzug");

  await abrufen(page, true);
  for (const [art, neu] of [
    ["umzug_art_kunden", "2"],
    ["umzug_art_projekte", "2"],
    ["umzug_art_taetigkeiten", "2"],
    ["umzug_art_zeiten", "4"],
    ["umzug_art_buchungen", "5"],
  ] as const)
    await expect(zahlen(page, t(art))).toHaveText([t(art), neu, "0", "0", "0"]);
  await axe(page);
  await page.getByRole("button", { name: t("umzug_uebernehmen"), exact: true }).click();
  await expect(
    page.getByText(/^Übernommen\. Die Originaldatei liegt unter ihrem SHA-256 [0-9a-f]{64}\.$/),
  ).toBeVisible();

  await page.getByRole("button", { name: t("umzug_neu_beginnen") }).click();
  await abrufen(page);
  await expect(zahlen(page, t("umzug_art_zeiten"))).toHaveText([
    t("umzug_art_zeiten"),
    "0",
    "4",
    "0",
    "0",
  ]);
  await expect(zahlen(page, t("umzug_art_buchungen"))).toHaveText([
    t("umzug_art_buchungen"),
    "0",
    "5",
    "0",
    "0",
  ]);
});

test("a private address is refused with its reason", async ({ page }) => {
  await betriebAnlegen(page);
  await page.goto("/umzug");
  await page.getByRole("radio", { name: "Kimai" }).check();
  await weiter(page);
  await page.getByLabel(t("umzug_abruf_instanz")).fill("https://169.254.169.254");
  await page.getByLabel(t("umzug_abruf_token")).fill(TOKEN);
  await page.getByRole("button", { name: t("umzug_abruf_los") }).click();
  await expect(page.getByText(t("umzug_abruf_adresse_ungueltig"))).toBeVisible();
});
