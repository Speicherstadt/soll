import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { xlsxSchreiben, type Zelle } from "../packages/import/src/xlsx-schreiben.ts";
import { betriebAnlegen, senden } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema } from "./thema.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

/**
 * The owner's own spreadsheet (S-702): headers Soll does not know for person, begin and end, a
 * building site as project and the work as activity; 2 September has 11:30 without a break
 */
const zeile = (tag: string, beginn: number, ende: number, pause: number): Zelle[] => [
  { text: "Jonas Weber" },
  { tag },
  { minuten: beginn },
  { minuten: ende },
  { zahl: pause },
  { text: "Bad Elbhof" },
  { text: "Montage" },
];
const MAPPE = Buffer.from(
  xlsxSchreiben("Stunden", [
    ["Wer", "Tag", "Kommen um", "Gehen um", "Pause", "Baustelle", "Leistung"].map((text) => ({
      text,
    })),
    zeile("2026-09-01", 7 * 60, 15 * 60 + 30, 30),
    zeile("2026-09-02", 7 * 60, 18 * 60 + 30, 0),
  ]),
);

const axe = async (page: Page) => {
  for (const farben of ["light", "dark"] as const) {
    await thema(page, farben);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
};

const weiter = (page: Page) =>
  page.getByRole("button", { name: t("einrichtung_weiter"), exact: true }).click();

const spalte = async (page: Page, feld: string, kopf: string) => {
  await page.getByLabel(t(feld), { exact: true }).selectOption(kopf);
  await expect(page.getByLabel(t(feld), { exact: true })).toHaveValue(kopf);
};

/** Through the steps with the workbook above, the columns chosen by hand */
const bisZurUebernahme = async (page: Page, pruefen = false) => {
  await page.getByRole("radio", { name: "Excel/CSV" }).check();
  await weiter(page);
  await page.getByLabel(t("umzug_datei_waehlen")).setInputFiles({
    name: "stunden.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: MAPPE,
  });
  // no header says who: the reader names the column it needs
  await expect(
    page.getByText(`Zeile 1: ${t("umzug_lese_spalte_fehlt")}: ${t("umzug_feld_person")}`),
  ).toBeVisible();
  await weiter(page);
  await spalte(page, "umzug_feld_person", "Wer");
  await spalte(page, "umzug_feld_beginn", "Kommen um");
  await spalte(page, "umzug_feld_ende", "Gehen um");
  await spalte(page, "umzug_feld_projekt", "Baustelle");
  // Soll proposes the owner for "Jonas Weber", the order and the activity by their names
  await expect(page.getByLabel("Jonas Weber")).toHaveValue(/.+/);
  await expect(page.getByLabel(/^Bad Elbhof/)).toHaveValue(/.+/);
  await expect(page.getByLabel(/^Montage/)).toHaveValue(/.+/);
  if (pruefen) await axe(page);
  await weiter(page);
  await expect(page.getByText("R-04 · § 4 Satz 3 ArbZG")).toBeVisible();
  await weiter(page);
};

const zahlen = (page: Page, art: string) =>
  page.getByRole("row", { name: new RegExp(`^${art}\\b`) }).getByRole("cell");

test("the owner takes over an Excel workbook with free columns, and a second run creates nothing twice", async ({
  page,
}) => {
  await betriebAnlegen(page);
  const kunde = await senden(page, "POST", "/api/v1/projektzeit/kunden", { name: "Elbhof" });
  await senden(page, "POST", "/api/v1/projektzeit/projekte", {
    kundeId: kunde.kundeId,
    name: "Bad Elbhof",
  });
  await senden(page, "POST", "/api/v1/projektzeit/taetigkeiten", { name: "Montage" });
  await page.goto("/umzug");

  // the templates of the tool, made by the server
  await page.getByRole("radio", { name: "Excel/CSV" }).check();
  await expect(page.getByText(t("umzug_anleitung_tabelle"))).toBeVisible();
  const laden = page.waitForEvent("download");
  await page
    .getByRole("link", { name: t("umzug_vorlage_datei", { datei: "soll-zeiten.xlsx" }) })
    .click();
  const vorlage = await laden;
  expect(vorlage.suggestedFilename()).toBe("soll-zeiten.xlsx");
  expect(
    readFileSync(await vorlage.path())
      .subarray(0, 2)
      .toString(),
  ).toBe("PK");
  await axe(page);

  await bisZurUebernahme(page, true);
  await page.getByRole("button", { name: t("umzug_probelauf") }).click();
  await expect(zahlen(page, t("umzug_art_zeiten"))).toHaveText([
    t("umzug_art_zeiten"),
    "2",
    "0",
    "0",
    "0",
  ]);
  await expect(zahlen(page, t("umzug_art_buchungen"))).toHaveText([
    t("umzug_art_buchungen"),
    "2",
    "0",
    "0",
    "0",
  ]);
  await axe(page);
  await page.getByRole("button", { name: t("umzug_uebernehmen"), exact: true }).click();
  await expect(
    page.getByText(/^Übernommen\. Die Originaldatei liegt unter ihrem SHA-256 [0-9a-f]{64}\.$/),
  ).toBeVisible();

  await page.getByRole("button", { name: t("umzug_neu_beginnen") }).click();
  await bisZurUebernahme(page);
  await page.getByRole("button", { name: t("umzug_probelauf") }).click();
  await expect(zahlen(page, t("umzug_art_zeiten"))).toHaveText([
    t("umzug_art_zeiten"),
    "0",
    "2",
    "0",
    "0",
  ]);
  await expect(zahlen(page, t("umzug_art_buchungen"))).toHaveText([
    t("umzug_art_buchungen"),
    "0",
    "2",
    "0",
    "0",
  ]);
});
