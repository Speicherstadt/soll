import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, senden } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de", timezoneId: "Europe/Berlin" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

const PZ = "/api/v1/projektzeit";

/** Yesterday in Berlin as YYYY-MM-DD: a day whose hours all lie in the past */
const gestern = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(
    Date.now() - 24 * 60 * 60 * 1000,
  );

/** A Berlin wall time on a day in UTC milliseconds, with the offset that day has (+01:00 or +02:00) */
const inBerlin = (tag: string, uhrzeit: string) => {
  const mittag = new Date(`${tag}T12:00:00Z`);
  const versatz = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Berlin",
    timeZoneName: "longOffset",
  })
    .formatToParts(mittag)
    .find((teil) => teil.type === "timeZoneName")
    ?.value.replace("GMT", "");
  return Date.parse(`${tag}T${uhrzeit}:00${versatz || "+00:00"}`);
};

/** Weber Haustechnik with the order "Bad Elbhof" and a booking of Montage yesterday, 8:00–11:30 */
const baustelle = async (page: Page) => {
  await betriebAnlegen(page);
  const kunde = await senden(page, "POST", `${PZ}/kunden`, { name: "Elbhof" });
  const projekt = await senden(page, "POST", `${PZ}/projekte`, {
    kundeId: kunde.kundeId,
    name: "Bad Elbhof",
  });
  const montage = await senden(page, "POST", `${PZ}/taetigkeiten`, { name: "Montage" });
  await senden(page, "POST", `${PZ}/buchungen`, {
    projektId: projekt.projektId,
    taetigkeitId: montage.taetigkeitId,
    beginn: inBerlin(gestern(), "08:00"),
    ende: inBerlin(gestern(), "11:30"),
    notiz: "Vorwand gesetzt",
  });
};

/**
 * axe in light and dark; after a switch of the theme it waits for the buttons' color transition to
 * end, so axe reads the colors of the theme, not a mix in between
 */
const axeGruen = async (page: Page) => {
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForFunction(() => document.getAnimations().length === 0);
    expect((await new AxeBuilder({ page }).analyze()).violations, theme).toEqual([]);
  }
};

/** A signature drawn with the pointer: two strokes across the surface */
const unterschreiben = async (page: Page) => {
  const flaeche = page.getByTestId("unterschrift");
  await flaeche.scrollIntoViewIfNeeded();
  const box = await flaeche.boundingBox();
  if (!box) throw new Error("no signature surface");
  const punkt = (x: number, y: number) => [box.x + box.width * x, box.y + box.height * y] as const;
  for (const strich of [
    [punkt(0.1, 0.7), punkt(0.25, 0.2), punkt(0.4, 0.75)],
    [punkt(0.5, 0.5), punkt(0.8, 0.45)],
  ]) {
    const [erster, ...rest] = strich;
    if (!erster) continue;
    await page.mouse.move(...erster);
    await page.mouse.down();
    for (const p of rest) await page.mouse.move(...p, { steps: 5 });
    await page.mouse.up();
  }
};

test("the customer signs the report on the phone and the PDF downloads @phone", async ({
  page,
}) => {
  await baustelle(page);
  await page.goto("/projekte");
  await page.getByRole("tab", { name: t("projekte_tab_nachweise") }).click();
  await expect(page.getByText(t("nachweis_liste_leer"))).toBeVisible();

  await page.getByLabel(t("nachweis_von")).fill(gestern());
  await page.getByLabel(t("nachweis_bis")).fill(gestern());
  const vorschau = page.getByRole("table", { name: t("nachweis_vorschau") });
  await expect(vorschau).toContainText("08:00–11:30");
  await expect(vorschau).toContainText("Montage");
  await expect(vorschau).toContainText("Vorwand gesetzt");
  await expect(page.getByText(t("nachweis_summe", { dauer: "3:30" }))).toBeVisible();

  const form = page.getByRole("form", { name: t("nachweis_unterschreiben") });
  await form.getByLabel(t("nachweis_bemerkung")).fill("2 Eckventile");
  await form.getByLabel(t("nachweis_unterzeichner")).fill("Erika Elbhof");
  // without a signature it is refused in the app
  await form.getByRole("button", { name: t("nachweis_unterschreiben") }).click();
  await expect(form.getByRole("alert")).toHaveText(t("nachweis_fehler_unterschrift"));
  await unterschreiben(page);

  await axeGruen(page);

  await form.getByRole("button", { name: t("nachweis_unterschreiben") }).click();
  await expect(page.getByRole("status")).toHaveText(t("nachweis_unterschrieben", { nummer: "1" }));
  // the booking is in the report now: nothing left to sign
  await expect(page.getByText(t("nachweis_leer"))).toBeVisible();
  const liste = page.getByRole("table", { name: t("nachweis_liste") });
  const zeile = liste.getByRole("row", { name: /Bad Elbhof/ });
  await expect(zeile).toContainText(t("nachweis_titel", { nummer: "1" }));
  await expect(zeile).toContainText("Erika Elbhof");
  await expect(zeile).toContainText("3:30");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    zeile.getByRole("link", { name: t("nachweis_pdf", { nummer: "1" }) }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("stundennachweis-1.pdf");
  const pfad = await download.path();
  const { readFileSync } = await import("node:fs");
  expect(readFileSync(pfad).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  await axeGruen(page);
});
