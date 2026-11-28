import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, senden, zweiterBrowser } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema } from "./thema.ts";

/*
 * Soll aus dem Plan (S-505): the owner switches the daily target source to the published shift
 * plan in Settings, and the month view shows the published shift as Soll against Ist.
 */

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

const vormonat = () => {
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(Date.now());
  const [jahr, monat] = heute.split("-").map(Number) as [number, number];
  return monat === 1 ? `${jahr - 1}-12` : `${jahr}-${String(monat - 1).padStart(2, "0")}`;
};

const axeGruen = async (page: Page) => {
  for (const farben of ["light", "dark"] as const) {
    await thema(page, farben);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  }
};

test("Soll aus dem Plan: Einstellung setzen und Soll gegen Ist im Monat prüfen @phone", async ({
  page,
  browser,
}) => {
  await betriebAnlegen(page);
  const standort = await senden(page, "POST", "/api/v1/standorte", { name: "Elbe", land: "HH" });
  const tom = await zweiterBrowser(browser, test.info());
  const tomId = await einladungAnnehmen(page, tom, "Tom Berger");

  const monat = vormonat();
  const tag = `${monat}-06`;

  // Publish one 6:00 shift (10:00–16:00) for Tom on the 6th of last month
  await senden(page, "POST", "/api/v1/dienstplan/schichten", {
    standortId: standort.standortId,
    tag,
    beginnMinute: 10 * 60,
    endeMinute: 16 * 60,
    pauseMinuten: 0,
    rolle: "Service",
    nutzerId: tomId,
  });
  await senden(page, "POST", "/api/v1/dienstplan/veroeffentlichen", {
    standortId: standort.standortId,
    tag,
  });

  // Tom worked 7:00 on that day
  for (const [art, uhrzeit] of [
    ["kommen", "09:00"],
    ["gehen", "16:00"],
  ] as const) {
    await senden(page, "POST", "/api/v1/arbeitszeit/stempelungen/nachtrag", {
      nutzerId: tomId,
      art,
      zeitpunkt: Date.parse(`${tag}T${uhrzeit}:00Z`),
      grund: "Schichtplan",
    });
  }

  // Owner switches daily target source to published plan from the 1st of that month in Settings
  await page.goto("/einstellungen");
  const abschnitt = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: t("target_source_title") }) });
  await expect(abschnitt).toBeVisible();
  await abschnitt.getByLabel(t("target_source_title")).selectOption("plan");
  const abFeld = abschnitt.getByLabel(t("target_source_from"));
  await abFeld.fill(`${monat}-01`);
  await abFeld.blur();
  await abschnitt.getByRole("button", { name: t("plan_speichern") }).click();
  await expect(
    abschnitt.getByRole("status").filter({
      hasText: `${t("target_source_plan")} ab ${monat}-01`,
    }),
  ).toBeVisible();
  await axeGruen(page);

  // Tom opens Monat and sees Soll 6:00 from the plan, Ist 7:00, Saldo +1:00 and the Plan badge
  await tom.goto("/monat");
  const summen = tom.locator(`section[aria-label="${t("monat_summen")}"]`);
  await expect(summen).toBeVisible();
  await expect(summen).toContainText("6:00");
  await expect(summen).toContainText("7:00");
  await expect(summen).toContainText("+1:00");
  await expect(tom.getByText(t("target_source_badge"), { exact: true }).first()).toBeVisible();
  await axeGruen(tom);
  await tom.context().close();
});
