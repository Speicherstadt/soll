import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema } from "./thema.ts";

/*
 * The move from Personio over its API v2 (S-704): the owner fetches from the stand-in of Personio
 * (apps/server/src/personio-ersatz-dienst.ts, built after Personio's descriptions), maps persons and
 * absence types, runs the dry run, takes over, and a second fetch creates nothing.
 */

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

/** The integration the stand-in knows (apps/server/src/personio-ersatz-dienst.ts) */
const CLIENT_ID = "papi-e2e-4711";
const CLIENT_SECRET = "papi-e2e-secret";

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

/** Personio chosen, the fetch filled in and sent, on to the dry run */
const abrufen = async (page: Page, pruefen = false) => {
  await page.getByRole("radio", { name: "Personio" }).check();
  await expect(page.getByText(t("umzug_anleitung_personio"))).toBeVisible();
  await weiter(page);
  await page.getByLabel(t("umzug_abruf_client_id")).fill(CLIENT_ID);
  await page.getByLabel(t("umzug_abruf_client_secret")).fill(CLIENT_SECRET);
  await page.getByLabel(t("umzug_abruf_von"), { exact: true }).fill("2026-09-01");
  await page.getByLabel(t("umzug_abruf_bis"), { exact: true }).fill("2026-09-30");
  if (pruefen) await axe(page);
  await page.getByRole("button", { name: t("umzug_abruf_los") }).click();
  // the open period, the pending one and the hours of time off in lieu are named with their line;
  // the secret is gone from the form
  await expect(page.getByText(`Zeile 14: ${t("umzug_lese_laeuft_noch")}`)).toBeVisible();
  await expect(page.getByText(`Zeile 15: ${t("umzug_lese_nicht_genehmigt")}`)).toBeVisible();
  await expect(page.getByText(`Zeile 19: ${t("umzug_lese_teil_tag")}`)).toBeVisible();
  await expect(page.getByLabel(t("umzug_abruf_client_secret"))).toHaveValue("");
  await weiter(page);
  // Soll proposes the owner for Personio's "Jonas Weber" and Soll's kinds for the absence types
  await expect(page.getByLabel("Jonas Weber")).toHaveValue(/.+/);
  await expect(page.getByLabel("Krankheit")).toHaveValue("krank");
  await expect(page.getByLabel("Urlaub")).toHaveValue("urlaub");
  if (pruefen) await axe(page);
  await weiter(page);
  await weiter(page);
  await page.getByRole("button", { name: t("umzug_probelauf") }).click();
};

test("the owner fetches from Personio, takes it over, and a second fetch creates nothing", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/umzug");

  await abrufen(page, true);
  for (const [art, neu] of [
    ["umzug_art_zeiten", "5"],
    ["umzug_art_abwesenheiten", "3"],
  ] as const)
    await expect(zahlen(page, t(art))).toHaveText([t(art), neu, "0", "0", "0"]);
  await axe(page);
  await page.getByRole("button", { name: t("umzug_uebernehmen"), exact: true }).click();
  await expect(
    page.getByText(/^Übernommen\. Die Originaldatei liegt unter ihrem SHA-256 [0-9a-f]{64}\.$/),
  ).toBeVisible();

  await page.getByRole("button", { name: t("umzug_neu_beginnen") }).click();
  await abrufen(page);
  for (const [art, vorhanden] of [
    ["umzug_art_zeiten", "5"],
    ["umzug_art_abwesenheiten", "3"],
  ] as const)
    await expect(zahlen(page, t(art))).toHaveText([t(art), "0", vorhanden, "0", "0"]);
});

test("wrong credentials are refused with their reason", async ({ page }) => {
  await betriebAnlegen(page);
  await page.goto("/umzug");
  await page.getByRole("radio", { name: "Personio" }).check();
  await weiter(page);
  await page.getByLabel(t("umzug_abruf_client_id")).fill(CLIENT_ID);
  await page.getByLabel(t("umzug_abruf_client_secret")).fill("falsch");
  await page.getByRole("button", { name: t("umzug_abruf_los") }).click();
  await expect(
    page.getByText(t("umzug_abruf_zugang_abgelehnt").replace("{werkzeug}", "Personio")),
  ).toBeVisible();
});
