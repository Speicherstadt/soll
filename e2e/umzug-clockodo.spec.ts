import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema } from "./thema.ts";

/*
 * The move from Clockodo over its API (S-703), against the stand-in built after the public SDK
 * (apps/server/src/clockodo-ersatz-dienst.ts, started by scripts/e2e-server.ts): Weber Haustechnik
 * in September 2026, Jonas (the owner) and Sandra, who is no member here.
 */

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

/** The access the stand-in takes */
const ZUGANG = { nutzer: "jonas@weber-haustechnik.test", schluessel: "ck_e2e_4711" };

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

/** Tool, fetch over the API, mapping and preview, up to the dry run */
const bisZurUebernahme = async (page: Page, pruefen = false) => {
  await page.getByRole("radio", { name: "Clockodo" }).check();
  await expect(page.getByText(t("umzug_anleitung_clockodo"))).toBeVisible();
  await weiter(page);
  await page.getByRole("radio", { name: t("umzug_weg_api") }).check();
  await page.getByLabel(t("umzug_abruf_nutzer")).fill(ZUGANG.nutzer);
  const schluessel = page.getByLabel(t("umzug_abruf_schluessel"));
  await expect(schluessel).toHaveAttribute("type", "password");
  await schluessel.fill(ZUGANG.schluessel);
  await page.getByLabel(t("umzug_abruf_von"), { exact: true }).fill("2026-09-01");
  await page.getByLabel(t("umzug_abruf_bis"), { exact: true }).fill("2026-09-30");
  if (pruefen) await axe(page);
  await page.getByRole("button", { name: t("umzug_abruf_los") }).click();
  await expect(
    page.getByText(
      t("umzug_gelesen", {
        zeiten: "4",
        abwesenheiten: "2",
        kunden: "2",
        projekte: "1",
        taetigkeiten: "2",
      }),
    ),
  ).toBeVisible();
  // the key is gone from the form once the fetch is done
  await expect(schluessel).toHaveValue("");
  await expect(
    page.getByText(/^Zeile \d+: im alten Tool beantragt, aber nicht genehmigt$/),
  ).toBeVisible();
  await weiter(page);
  // Jonas is proposed by name, Clockodo's leave and sickness as Soll's kinds; Sandra is no member
  await expect(page.getByLabel("Jonas Weber")).toHaveValue(/.+/);
  await expect(page.getByLabel("Regular holiday")).toHaveValue("urlaub");
  await expect(page.getByLabel("Sick day")).toHaveValue("krank");
  await expect(page.getByRole("heading", { name: t("umzug_taetigkeiten_titel") })).toBeVisible();
  await expect(page.getByLabel("Montage")).toHaveValue("neu");
  if (pruefen) await axe(page);
  await weiter(page);
  await weiter(page);
  await page.getByRole("button", { name: t("umzug_probelauf") }).click();
};

test("the owner moves from Clockodo over its API, and a second fetch creates nothing twice", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/umzug");
  await bisZurUebernahme(page, true);
  // three spans of Jonas (two touching entries are one), Sandra's left out
  await expect(zahlen(page, t("umzug_art_zeiten"))).toHaveText([
    t("umzug_art_zeiten"),
    "3",
    "0",
    "1",
    "0",
  ]);
  await expect(zahlen(page, t("umzug_art_taetigkeiten"))).toHaveText([
    t("umzug_art_taetigkeiten"),
    "2",
    "0",
    "0",
    "0",
  ]);
  await axe(page);
  await page.getByRole("button", { name: t("umzug_uebernehmen"), exact: true }).click();
  await expect(
    page.getByRole("link", {
      name: t("umzug_datei_laden", { name: "clockodo-2026-09-01-2026-09-30.jsonl" }),
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: t("umzug_neu_beginnen") }).click();
  await bisZurUebernahme(page);
  await expect(zahlen(page, t("umzug_art_zeiten"))).toHaveText([
    t("umzug_art_zeiten"),
    "0",
    "3",
    "1",
    "0",
  ]);
  await expect(zahlen(page, t("umzug_art_abwesenheiten"))).toHaveText([
    t("umzug_art_abwesenheiten"),
    "0",
    "2",
    "0",
    "0",
  ]);

  // 2 September: two spans with the break between them as clocked in Clockodo
  await page.goto("/zeiten");
  await page.getByLabel(t("zeiten_datum"), { exact: true }).fill("2026-09-02");
  await page.getByLabel(t("zeiten_datum"), { exact: true }).dispatchEvent("change");
  await expect(page.getByText(t("stempel_uebernommen", { quelle: "Clockodo" }))).toHaveCount(4);
});
