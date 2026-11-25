import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema } from "./thema.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

/** The owner's old tool: two days of work, a week of leave, a customer with an order (S-701) */
const DATEI = [
  "Typ;Kennung;Person;Datum;Beginn;Ende;Pause;Bis;Art;Kunde;Name;Nummer",
  "zeit;z-1;Jonas Weber;01.09.2026;7:00;15:30;30;;;;;",
  "zeit;z-2;Jonas Weber;02.09.2026;7:00;18:30;0;;;;;",
  "zeit;z-3;Jonas Weber;31.09.2026;7:00;12:00;;;;;;",
  "abwesenheit;a-1;Jonas Weber;07.09.2026;;;;11.09.2026;Urlaub;;;",
  "kunde;k-1;;;;;;;;;Elbhof Immobilien;K-1001",
  "projekt;p-1;;;;;;;;k-1;Bad Elbhof;A-17",
].join("\r\n");

const axe = async (page: Page) => {
  for (const farben of ["light", "dark"] as const) {
    await thema(page, farben);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
};

const weiter = (page: Page) =>
  page.getByRole("button", { name: t("einrichtung_weiter"), exact: true }).click();

/** Goes through the steps up to the takeover with the file above */
const bisZurUebernahme = async (page: Page, pruefen = false) => {
  await expect(page.getByRole("radio", { name: "Soll-CSV" })).toBeChecked();
  await weiter(page);
  await page.getByLabel(t("umzug_datei_waehlen")).setInputFiles({
    name: "altes-tool.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(DATEI, "utf8"),
  });
  await expect(
    page.getByText(
      t("umzug_gelesen", {
        zeiten: "2",
        abwesenheiten: "1",
        kunden: "1",
        projekte: "1",
        taetigkeiten: "0",
      }),
    ),
  ).toBeVisible();
  await expect(page.getByText(/^Zeile 4: kein gültiges Datum/)).toBeVisible();
  await weiter(page);
  // Soll proposes the owner for "Jonas Weber" and leave for "Urlaub"
  await expect(page.getByLabel("Jonas Weber")).toHaveValue(/.+/);
  // the kind of absence "Urlaub", not the column "Resturlaub" of the balances (S-708)
  await expect(page.getByLabel(/^Urlaub/)).toHaveValue("urlaub");
  if (pruefen) await axe(page);
  await weiter(page);
  // 11:30 without a break on 2 September: shown with its norm, not changed
  await expect(page.getByText("R-04 · § 4 Satz 3 ArbZG")).toBeVisible();
  if (pruefen) await axe(page);
  await weiter(page);
};

const zahlen = (page: Page, art: string) =>
  page.getByRole("row", { name: new RegExp(`^${art}\\b`) }).getByRole("cell");

test("the owner moves from another tool, and a second run creates nothing twice", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/einstellungen");
  await page.getByRole("link", { name: t("umzug_link") }).click();
  await expect(page).toHaveURL("/umzug");
  await expect(page.getByText(t("umzug_liste_leer"))).toBeVisible();
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
  await axe(page);
  await page.getByRole("button", { name: t("umzug_uebernehmen"), exact: true }).click();
  await expect(
    page.getByText(/^Übernommen\. Die Originaldatei liegt unter ihrem SHA-256 [0-9a-f]{64}\.$/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: t("umzug_datei_laden", { name: "altes-tool.csv" }) }),
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
  await expect(zahlen(page, t("umzug_art_kunden"))).toHaveText([
    t("umzug_art_kunden"),
    "0",
    "1",
    "0",
    "0",
  ]);

  // the stamps of 1 September carry where they came from
  await page.goto("/zeiten");
  await page.getByLabel(t("zeiten_datum"), { exact: true }).fill("2026-09-01");
  await page.getByLabel(t("zeiten_datum"), { exact: true }).dispatchEvent("change");
  await expect(
    page.getByText(t("stempel_uebernommen", { quelle: "Soll-CSV" })).first(),
  ).toBeVisible();
});
