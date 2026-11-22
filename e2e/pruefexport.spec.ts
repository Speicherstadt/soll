import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { senden, weberMitSandra } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

/** The month before this one in Berlin: the period the page starts with */
const vormonat = () => {
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(Date.now());
  const [jahr, monat] = heute.split("-").map(Number) as [number, number];
  return monat === 1 ? `${jahr - 1}-12` : `${jahr}-${String(monat - 1).padStart(2, "0")}`;
};
const letzter = (monat: string) => {
  const [jahr, m] = monat.split("-").map(Number) as [number, number];
  return `${monat}-${String(new Date(Date.UTC(jahr, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

/** Sandra worked 8:00 to 16:30 on the 6th of last month, added by the owner with a reason */
const mitTag = async (jonas: Page, nutzerId: string) => {
  for (const [art, uhrzeit] of [
    ["kommen", "06:00"],
    ["gehen", "14:30"],
  ] as const)
    await senden(jonas, "POST", "/api/v1/arbeitszeit/stempelungen/nachtrag", {
      nutzerId,
      art,
      zeitpunkt: Date.parse(`${vormonat()}-06T${uhrzeit}:00Z`),
      grund: "Stundenzettel auf Papier",
    });
};

const herunterladen = async (page: Page, name: string) => {
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name }).click();
  const datei = await download;
  return { name: datei.suggestedFilename(), inhalt: await readFile((await datei.path()) ?? "") };
};

test("the owner downloads the Prüfexport of everyone as CSV and PDF @phone", async ({
  page,
  browser,
}) => {
  const { jonas, nutzerId } = await weberMitSandra(page, browser, test.info());
  await mitTag(jonas, nutzerId);
  await jonas.goto("/zeiten");
  await jonas.getByRole("link", { name: t("pruefexport_titel") }).click();
  await expect(jonas).toHaveURL("/export");
  await expect(jonas.getByLabel(t("pruefexport_von"))).toHaveValue(`${vormonat()}-01`);
  await expect(jonas.getByLabel(t("zeiten_person"))).toHaveValue("*");
  const periode = `${vormonat()}-01-${letzter(vormonat())}`;

  const csv = await herunterladen(jonas, t("pruefexport_csv"));
  expect(csv.name).toBe(`pruefexport-${periode}.csv`);
  const text = csv.inhalt.toString("utf8");
  expect(text.startsWith("﻿Person;Datum;Beginn;Ende;")).toBe(true);
  expect(text).toContain("Grund: Stundenzettel auf Papier");
  expect(text).toMatch(/\r\nSandra Kühn;06\.\d\d\.\d{4};\d\d:00;\d\d:30;0;510;/);

  const pdf = await herunterladen(jonas, t("pruefexport_pdf"));
  expect(pdf.name).toBe(`pruefexport-${periode}.pdf`);
  expect(pdf.inhalt.subarray(0, 5).toString()).toBe("%PDF-");

  // a period longer than two years gives no download
  await jonas.getByLabel(t("pruefexport_von")).fill("2020-01-01");
  await expect(jonas.getByRole("alert")).toHaveText(t("pruefexport_fehler_zeitraum"));
  await expect(jonas.getByRole("link", { name: t("pruefexport_csv") })).toHaveCount(0);
});

test("a person downloads their own days and their Auskunft @phone", async ({ page, browser }) => {
  const { jonas, nutzerId } = await weberMitSandra(page, browser, test.info());
  await mitTag(jonas, nutzerId);
  await page.goto("/einstellungen");
  await page.getByRole("link", { name: t("auskunft_titel") }).click();
  await expect(page).toHaveURL("/export");
  // no list of people: Sandra sees only her own times
  await expect(page.getByLabel(t("zeiten_person"))).toHaveCount(0);
  const csv = await herunterladen(page, t("pruefexport_csv"));
  expect(csv.inhalt.toString("utf8")).toContain("\r\nSandra Kühn;06.");

  const auskunft = await herunterladen(page, t("auskunft_herunterladen"));
  expect(auskunft.name).toMatch(/^auskunft-\d{4}-\d\d-\d\d\.json$/);
  const daten = JSON.parse(auskunft.inhalt.toString("utf8"));
  expect(daten.art).toBe("Auskunft nach Art. 15 DSGVO");
  expect(daten.konto.name).toBe("Sandra Kühn");
  expect(daten.stempelungen).toHaveLength(2);
  expect(daten.verantwortlicher.betrieb).toBe("Weber Haustechnik");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
