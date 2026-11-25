import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { senden, weberMitSandra } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema } from "./thema.ts";

/*
 * The balances on a cut-off date (BAULISTE.md S-708): the owner takes them over from a Soll-CSV and
 * sees them in the preview; the person sees her start balance in her accounts and in the month of
 * the cut-off date, which its Prüfwert will cover.
 */

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

/** The first day of this month and of the one before, in Berlin, as YYYY-MM-DD */
const monatsersten = () => {
  const [jahr, monat] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" })
    .format(Date.now())
    .split("-")
    .map(Number) as [number, number];
  const vorher = monat === 1 ? [jahr - 1, 12] : [jahr, monat - 1];
  const tag = (j: number, m: number) => `${j}-${String(m).padStart(2, "0")}-01`;
  return { dieser: tag(jahr, monat), voriger: tag(vorher[0] as number, vorher[1] as number) };
};

const deutsch = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.${tag.slice(0, 4)}`;

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

test("the owner takes over balances on a cut-off date from a Soll-CSV, checked in the preview", async ({
  page,
  browser,
}) => {
  const { jonas } = await weberMitSandra(page, browser, test.info());
  const stichtag = monatsersten().dieser;
  const datei = [
    "Typ;Kennung;Person;Datum;Überstunden;Resturlaub",
    `saldo;s-1;Sandra Kühn;${deutsch(stichtag)};-3:15;8,5`,
  ].join("\r\n");
  await jonas.goto("/umzug");
  await expect(jonas.getByRole("button", { name: t("umzug_vorlage_salden") })).toBeVisible();
  await weiter(jonas);
  await jonas.getByLabel(t("umzug_datei_waehlen")).setInputFiles({
    name: "salden.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(datei, "utf8"),
  });
  await weiter(jonas);
  await expect(jonas.getByLabel("Sandra Kühn")).toHaveValue(/.+/);
  await weiter(jonas);
  // the preview shows each balance to compare with the old tool
  const salden = jonas.getByRole("table", { name: t("umzug_salden_titel") });
  await expect(salden.getByRole("row", { name: /Sandra Kühn/ })).toContainText("-3:15");
  await expect(salden.getByRole("row", { name: /Sandra Kühn/ })).toContainText("8,5");
  await axe(jonas);
  await weiter(jonas);
  await jonas.getByRole("button", { name: t("umzug_probelauf") }).click();
  await expect(zahlen(jonas, t("umzug_art_salden"))).toHaveText([
    t("umzug_art_salden"),
    "1",
    "0",
    "0",
    "0",
  ]);
  await jonas.getByRole("button", { name: t("umzug_uebernehmen"), exact: true }).click();
  await expect(jonas.getByText(/^Übernommen\./)).toBeVisible();

  // the accounts of Sandra name both, taken over from the Soll-CSV
  await jonas.goto("/abwesenheiten");
  const konten = jonas.getByRole("region", { name: t("konten_titel") });
  await konten.getByLabel(t("konten_person")).selectOption({ label: "Sandra Kühn" });
  await expect(konten).toContainText(t("konten_art_urlaub_stichtag"));
  await expect(konten).toContainText("übernommen aus Soll-CSV");
});

test("Sandra sees her start balance in her accounts and in the month of the cut-off date @phone", async ({
  page,
  browser,
}) => {
  const { jonas, nutzerId } = await weberMitSandra(page, browser, test.info());
  const monat = monatsersten().voriger.slice(0, 7);
  const pfad = `/api/v1/arbeitszeit/konten/${nutzerId}/anpassungen`;
  const grund = "Stand aus der alten Liste";
  await senden(jonas, "POST", pfad, { art: "startsaldo", monat, minuten: 450, grund });
  await senden(jonas, "POST", pfad, { art: "urlaub_stichtag", monat, halbtage: 17, grund });

  await page.goto("/abwesenheiten");
  const konten = page.getByRole("region", { name: t("konten_titel") });
  await expect(konten).toContainText(t("konten_art_urlaub_stichtag"));
  await expect(konten).toContainText(grund);

  // the month of the cut-off date (the month page opens on the month before this one)
  await page.goto("/monat");
  const titel = t("monat_startsaldo_titel", { datum: "" }).trim();
  const startsaldo = page.getByRole("region", { name: new RegExp(`^${titel}`) });
  await expect(startsaldo).toContainText("+7:30");
  await expect(startsaldo).toContainText("8,5");
  await expect(startsaldo).toContainText(grund);
  await axe(page);
});
