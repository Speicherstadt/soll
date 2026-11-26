import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, senden, zweiterBrowser } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

/** The month before this one in Berlin: the month the export offers first */
const vormonat = () => {
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(Date.now());
  const [jahr, monat] = heute.split("-").map(Number) as [number, number];
  return monat === 1 ? `${jahr - 1}-12` : `${jahr}-${String(monat - 1).padStart(2, "0")}`;
};

/**
 * Weber Haustechnik with Sandra on 21,50 € an hour, who worked 8 hours on the 6th of last month;
 * she confirms the month and Jonas closes it, all through the API
 */
const weberAbgeschlossen = async (jonas: Page, sandra: Page) => {
  await betriebAnlegen(jonas);
  const nutzerId = await einladungAnnehmen(jonas, sandra, "Sandra Kühn");
  const modell = await senden(jonas, "POST", "/api/v1/arbeitszeit/modelle", {
    name: "Stundenlohn",
    sollMinuten: [480, 480, 480, 480, 480, 0, 0],
    lohnArt: "stunde",
    lohnCent: 2150,
    minijob: false,
    gueltigAb: "2026-01-01",
  });
  const monat = vormonat();
  await senden(jonas, "PUT", `/api/v1/arbeitszeit/personen/${nutzerId}/modell`, {
    modellId: modell.modellId,
    gueltigAb: `${monat}-01`,
  });
  // in UTC: on the 6th the clocks never change, so the day keeps its 8 hours in Berlin
  for (const [art, uhrzeit] of [
    ["kommen", "07:00"],
    ["pause_beginn", "11:00"],
    ["pause_ende", "11:30"],
    ["gehen", "15:30"],
  ] as const)
    await senden(jonas, "POST", "/api/v1/arbeitszeit/stempelungen/nachtrag", {
      nutzerId,
      art,
      zeitpunkt: Date.parse(`${monat}-06T${uhrzeit}:00Z`),
      grund: "Stundenzettel auf Papier",
    });
  await senden(sandra, "POST", "/api/v1/arbeitszeit/monat/bestaetigen", { monat });
  await senden(jonas, "POST", "/api/v1/arbeitszeit/monat/abschliessen", { monat, nutzerId });
  return { monat };
};

const axeGruen = async (page: Page) => {
  const ergebnis = await new AxeBuilder({ page }).analyze();
  expect(ergebnis.violations).toEqual([]);
};

test("the owner maps the wage types and downloads the LODAS file of the closed month", async ({
  page,
  browser,
}) => {
  const sandra = await zweiterBrowser(browser, test.info());
  const { monat } = await weberAbgeschlossen(page, sandra);
  const [jahr, mm] = monat.split("-");

  // without a mapping the export says what is missing instead of guessing
  await page.goto("/auswertungen");
  await page.getByRole("button", { name: t("datev_herunterladen") }).click();
  const fehlend = page.getByRole("alert").filter({ hasText: t("datev_fehlend_titel") });
  await expect(fehlend).toContainText(t("datev_fehlend_beraternummer"));
  await expect(fehlend).toContainText(t("datev_fehlend_personalnummer", { name: "Sandra Kühn" }));
  await expect(fehlend).toContainText(
    t("datev_fehlend_lohnart", { posten: t("datev_posten_stunden") }),
  );
  await axeGruen(page);

  await page.goto("/einstellungen");
  await page.getByRole("tab", { name: t("einstellungen_tab_export") }).click();
  const abschnitt = page.getByRole("region", { name: t("datev_titel") });
  await abschnitt.getByLabel(t("datev_berater")).fill("1234567");
  await abschnitt.getByLabel(t("datev_mandant")).fill("10001");
  await abschnitt.getByLabel(t("datev_personalnummer", { name: "Sandra Kühn" })).fill("101");
  await abschnitt.getByLabel(t("datev_posten_stunden"), { exact: true }).fill("1000");
  await abschnitt.getByLabel(t("datev_posten_feiertag")).fill("1010");
  await abschnitt.getByRole("button", { name: t("datev_speichern") }).click();
  await expect(abschnitt.getByRole("status")).toHaveText(t("datev_gespeichert"));
  await axeGruen(page);

  await page.goto("/auswertungen");
  await page.getByLabel(t("datev_ziel")).selectOption("lodas");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: t("datev_herunterladen") }).click();
  const datei = await download;
  expect(datei.suggestedFilename()).toBe(`DATEV_LODAS_${monat}.txt`);
  const text = await readFile(await datei.path(), "latin1");
  expect(text.startsWith("[Allgemein]\r\nZiel=LODAS\r\n")).toBe(true);
  expect(text).toContain("BeraterNr=1234567\r\n");
  expect(text).toContain(`1;01.${mm}.${jahr};101;1000;1;8,00;\r\n`);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("the export and its mapping pass axe in the dark theme", async ({ page, browser }) => {
  const sandra = await zweiterBrowser(browser, test.info());
  await weberAbgeschlossen(page, sandra);
  await page.goto("/einstellungen");
  await page.getByRole("tab", { name: t("einstellungen_tab_konto") }).click();
  await page
    .getByRole("main")
    .getByRole("group", { name: t("theme_label") })
    .getByRole("button", { name: t("theme_dunkel") })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("tab", { name: t("einstellungen_tab_export") }).click();
  await expect(page.getByRole("region", { name: t("datev_titel") })).toBeVisible();
  await axeGruen(page);
  await page.goto("/auswertungen");
  await expect(page.getByRole("button", { name: t("datev_herunterladen") })).toBeVisible();
  await axeGruen(page);
});

test("a colleague sees neither the export nor the mapping", async ({ page, browser }) => {
  const jonas = await zweiterBrowser(browser, test.info());
  await weberAbgeschlossen(jonas, page);
  await page.goto("/auswertungen");
  await expect(page.getByText(t("seite_leer"))).toBeVisible();
  await expect(page.getByRole("button", { name: t("datev_herunterladen") })).toHaveCount(0);
  await page.goto("/einstellungen");
  await page.getByRole("tab", { name: t("einstellungen_tab_konto") }).click();
  await expect(page.getByRole("heading", { name: t("darstellung_titel") })).toBeVisible();
  await expect(page.getByRole("region", { name: t("datev_titel") })).toHaveCount(0);
});
