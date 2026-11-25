import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, senden } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema } from "./thema.ts";

/*
 * The move from a shift planner (S-706): the owner fetches from the stand-in of Crewmeister's API
 * (apps/server/src/schichtplaner-ersatz-dienst.ts, built after the sources named there), maps the
 * people and the site of the shifts, runs the dry run, takes over, finds the shifts as a draft in
 * the plan, and a second fetch creates nothing. Papershift and Planday share the way from the file
 * on (one reader, one plan), so one tool goes the whole way.
 */

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

const EMAIL = "inhaber@weber.test";
const PASSWORT = "crewmeister-e2e";

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

/** Crewmeister chosen, the fetch filled in and sent, the site chosen, on to the dry run */
const abrufen = async (page: Page, pruefen = false) => {
  await page.getByRole("radio", { name: "Crewmeister" }).check();
  await expect(page.getByText(t("umzug_anleitung_crewmeister"))).toBeVisible();
  await weiter(page);
  await page.getByLabel(t("umzug_abruf_email")).fill(EMAIL);
  await page.getByLabel(t("umzug_abruf_passwort")).fill(PASSWORT);
  await page.getByLabel(t("umzug_abruf_von"), { exact: true }).fill("2026-09-01");
  await page.getByLabel(t("umzug_abruf_bis"), { exact: true }).fill("2026-09-30");
  if (pruefen) await axe(page);
  await page.getByRole("button", { name: t("umzug_abruf_los") }).click();
  // the chain still open is named with its line; the password is gone from the form
  await expect(
    page.getByText(
      new RegExp(`^Zeile \\d+: ${t("umzug_lese_laeuft_noch").replace(/[()]/g, "\\$&")}`),
    ),
  ).toBeVisible();
  await expect(
    page.getByText(t("umzug_gelesen_schichten").replace("{schichten}", "3")),
  ).toBeVisible();
  await expect(page.getByLabel(t("umzug_abruf_passwort"))).toHaveValue("");
  await expect(page.getByLabel(t("umzug_abruf_email"))).toHaveValue(EMAIL);
  await weiter(page);
  // Soll proposes the owner for Crewmeister's "Jonas Weber"; the shifts need a site
  await expect(page.getByLabel("Jonas Weber")).toHaveValue(/.+/);
  await expect(page.getByRole("heading", { name: t("umzug_schichten_titel") })).toBeVisible();
  await page.getByLabel(t("umzug_schichten_standort")).selectOption({ label: "Elbe" });
  if (pruefen) await axe(page);
  await weiter(page);
  await weiter(page);
  await page.getByRole("button", { name: t("umzug_probelauf") }).click();
};

test("the owner fetches from Crewmeister, takes shifts, times and absences over, and a second fetch creates nothing", async ({
  page,
}) => {
  await betriebAnlegen(page);
  const { standortId } = await senden(page, "POST", "/api/v1/standorte", {
    name: "Elbe",
    land: "HH",
  });
  await page.goto("/umzug");

  await abrufen(page, true);
  for (const [art, werte] of [
    ["umzug_art_zeiten", ["2", "0", "2", "0"]],
    ["umzug_art_abwesenheiten", ["1", "0", "2", "0"]],
    ["umzug_art_schichten", ["2", "0", "1", "0"]],
  ] as const)
    await expect(zahlen(page, t(art))).toHaveText([t(art), ...werte]);
  await axe(page);
  await page.getByRole("button", { name: t("umzug_uebernehmen"), exact: true }).click();
  await expect(
    page.getByText(/^Übernommen\. Die Originaldatei liegt unter ihrem SHA-256 [0-9a-f]{64}\.$/),
  ).toBeVisible();

  // the shifts are in the plan of the site, Tom's from Crewmeister with his workplace as the role
  const woche = await page.request.get(
    `/api/v1/dienstplan/woche?standortId=${standortId}&tag=2026-09-01`,
  );
  expect(woche.ok()).toBe(true);
  expect(JSON.stringify(await woche.json())).toContain("Küche");

  await page.getByRole("button", { name: t("umzug_neu_beginnen") }).click();
  await abrufen(page);
  await expect(zahlen(page, t("umzug_art_schichten"))).toHaveText([
    t("umzug_art_schichten"),
    "0",
    "2",
    "1",
    "0",
  ]);
  await expect(zahlen(page, t("umzug_art_zeiten"))).toHaveText([
    t("umzug_art_zeiten"),
    "0",
    "2",
    "2",
    "0",
  ]);
});

test("a wrong password is refused with its reason", async ({ page }) => {
  await betriebAnlegen(page);
  await page.goto("/umzug");
  await page.getByRole("radio", { name: "Crewmeister" }).check();
  await weiter(page);
  await page.getByLabel(t("umzug_abruf_email")).fill(EMAIL);
  await page.getByLabel(t("umzug_abruf_passwort")).fill("falsch");
  await page.getByRole("button", { name: t("umzug_abruf_los") }).click();
  await expect(
    page.getByText(t("umzug_abruf_zugang_abgelehnt").replace("{werkzeug}", "Crewmeister")),
  ).toBeVisible();
});
