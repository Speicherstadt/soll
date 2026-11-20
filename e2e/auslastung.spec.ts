import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, senden, zweiterBrowser } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de", timezoneId: "Europe/Berlin" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

const PZ = "/api/v1/projektzeit";

/** The 10th of last month in Berlin, at an hour in UTC: whole minutes, a month that has ended */
const imVormonat = (stunde: number) => {
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const [jahr, monat] = heute.split("-").map(Number) as [number, number];
  return Date.UTC(monat === 1 ? jahr - 1 : jahr, monat === 1 ? 11 : monat - 2, 10, stunde);
};

/** A shift of 8 hours on the 10th of last month, added by the owner */
const schicht = async (jonas: Page, nutzerId?: string) => {
  for (const [art, stunde] of [
    ["kommen", 6],
    ["gehen", 14],
  ] as const)
    await senden(jonas, "POST", "/api/v1/arbeitszeit/stempelungen/nachtrag", {
      ...(nutzerId ? { nutzerId } : {}),
      art,
      zeitpunkt: imVormonat(stunde),
      grund: "Papierzettel",
    });
};

const axe = async (page: Page) => {
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    // colors fade on buttons (transition-colors): axe reads them once the fade has ended
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished)),
    );
    expect((await new AxeBuilder({ page }).analyze()).violations, theme).toEqual([]);
  }
};

test("shows the team, switches the view per person on, and the employee sees it @phone", async ({
  page: sandra,
  browser,
}, info) => {
  const jonas = await zweiterBrowser(browser, info);
  const max = await zweiterBrowser(browser, info);
  await betriebAnlegen(jonas);
  const sandraId = await einladungAnnehmen(jonas, sandra, "Sandra");
  const maxId = await einladungAnnehmen(jonas, max, "Max");
  const kunde = await senden(jonas, "POST", `${PZ}/kunden`, { name: "Elbhof" });
  const projekt = await senden(jonas, "POST", `${PZ}/projekte`, {
    kundeId: kunde.kundeId,
    name: "Bad Elbhof",
  });
  const montage = await senden(jonas, "POST", `${PZ}/taetigkeiten`, { name: "Montage" });
  for (const nutzerId of [undefined, sandraId, maxId]) await schicht(jonas, nutzerId);
  await senden(jonas, "POST", `${PZ}/buchungen`, {
    nutzerId: sandraId,
    projektId: projekt.projektId,
    taetigkeitId: montage.taetigkeitId,
    beginn: imVormonat(6),
    ende: imVormonat(12),
  });
  await senden(jonas, "POST", `${PZ}/buchungen`, {
    nutzerId: maxId,
    projektId: null,
    taetigkeitId: "fahrt",
    beginn: imVormonat(6),
    ende: imVormonat(8),
  });

  // off: Sandra sees no utilisation and no notice
  await sandra.goto("/auswertungen");
  await expect(sandra.getByText(t("seite_leer"))).toBeVisible();
  await expect(sandra.getByRole("region", { name: t("auslastung_titel") })).toHaveCount(0);

  // the team of last month: three people, no names
  await jonas.goto("/auswertungen");
  const bereich = jonas.getByRole("region", { name: t("auslastung_titel") });
  await expect(bereich.getByText("24:00", { exact: true })).toBeVisible();
  await expect(bereich.getByText(t("auslastung_prozent", { prozent: "25" }))).toBeVisible();
  await expect(bereich.getByText("16:00", { exact: true })).toBeVisible();
  await expect(bereich.getByRole("table")).toHaveCount(0);
  await axe(jonas);

  // the owner switches the view per person on: every person, and the notice on every page
  await bereich.getByLabel(t("auslastung_je_person")).check();
  const zeile = bereich.getByRole("row", { name: /Sandra/ });
  await expect(zeile).toContainText("8:00");
  await expect(zeile).toContainText(t("auslastung_prozent", { prozent: "75" }));
  await expect(jonas.getByText(t("auslastung_norm")).first()).toBeVisible();

  await sandra.goto("/");
  await expect(sandra.getByText(/Auswertung je Person ist eingeschaltet seit/)).toBeVisible();
  await sandra.goto("/auswertungen");
  const eigene = sandra.getByRole("region", { name: t("auslastung_titel") });
  await expect(eigene.getByText("8:00", { exact: true })).toBeVisible();
  await expect(eigene.getByText(t("auslastung_prozent", { prozent: "75" }))).toBeVisible();
  await axe(sandra);
});
