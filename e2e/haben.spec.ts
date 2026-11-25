import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, senden } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema } from "./thema.ts";

test.use({ locale: "de", timezoneId: "Europe/Berlin" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

const PZ = "/api/v1/projektzeit";
// the stand-in for Haben next to the e2e server (scripts/e2e-server.ts)
const HABEN = "http://127.0.0.1:28210";

/** Yesterday in Berlin as YYYY-MM-DD: a day whose hours all lie in the past */
const gestern = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(
    Date.now() - 24 * 60 * 60 * 1000,
  );

/** A Berlin wall time on a day in UTC milliseconds, with the offset that day has */
const inBerlin = (tag: string, uhrzeit: string) => {
  const versatz = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Berlin",
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(`${tag}T12:00:00Z`))
    .find((teil) => teil.type === "timeZoneName")
    ?.value.replace("GMT", "");
  return Date.parse(`${tag}T${uhrzeit}:00${versatz || "+00:00"}`);
};

/** Weber Haustechnik with the customer Elbhof, the order "Bad Elbhof" and Montage yesterday 8:00–11:30 */
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

const axeGruen = async (page: Page) => {
  for (const theme of ["light", "dark"] as const) {
    await thema(page, theme);
    expect((await new AxeBuilder({ page }).analyze()).violations, theme).toEqual([]);
  }
};

test("the owner connects Haben, links the customer and hands the booking over @phone", async ({
  page,
}) => {
  await baustelle(page);
  await page.goto("/projekte");
  await page.getByRole("tab", { name: t("projekte_tab_haben") }).click();

  const zugang = page.getByRole("form", { name: t("haben_zugang") });
  await zugang.getByLabel(t("haben_adresse")).fill(HABEN);
  await zugang.getByLabel(t("haben_token")).fill("hb_e2e");
  await zugang.getByRole("button", { name: t("haben_speichern") }).click();
  await expect(zugang.getByText(t("haben_token_gesetzt"))).toBeVisible();
  await expect(zugang.getByLabel(t("haben_token"))).toHaveValue("");

  // the contact from Haben, linked with the customer of the same business
  const kontakte = page.getByRole("table", { name: t("haben_kontakte") });
  const elbhof = kontakte.getByRole("row", { name: /Elbhof Immobilien GmbH/ });
  await elbhof.getByLabel(t("haben_kunde_fuer", { name: "Elbhof Immobilien GmbH" })).selectOption({
    label: "Elbhof",
  });
  await elbhof
    .getByRole("button", { name: t("haben_verbinden_mit", { name: "Elbhof Immobilien GmbH" }) })
    .click();
  await expect(elbhof).toContainText(t("haben_verbunden_kunde", { name: "Elbhof" }));

  await page.getByLabel(t("nachweis_von")).last().fill(gestern());
  await page.getByLabel(t("nachweis_bis")).last().fill(gestern());
  const buchungen = page.getByRole("table", { name: t("haben_buchungen") });
  await expect(buchungen).toContainText("08:00–11:30");
  await expect(buchungen).toContainText(t("haben_stand_offen"));

  await axeGruen(page);

  await page.getByRole("button", { name: t("haben_uebergeben", { anzahl: "1" }) }).click();
  await expect(page.getByRole("status")).toHaveText(
    t("haben_uebergeben_ergebnis", { gesendet: "1" }),
  );
  await expect(buchungen).toContainText(t("haben_stand_gesendet"));
  // nothing left to hand over
  await expect(
    page.getByRole("button", { name: t("haben_uebergeben", { anzahl: "1" }) }),
  ).toHaveCount(0);

  await axeGruen(page);
});
