import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { senden } from "./betrieb.ts";
import {
  ab,
  angabenSetzen,
  befundZeigt,
  betriebMitPlan,
  heute,
  hinweise,
  modellMitLohn,
  planAktion,
  planen,
  plus,
  t,
} from "./plan.ts";

/*
 * Every rule of Phase 2 that reads planned shifts has its case in the plan (BAULISTE.md S-502):
 * the ArbZG, the minimum wage, the mini-job limit and § 12 TzBfG here, the JArbSchG and the MuSchG
 * in dienstplan-schutz.spec.ts.
 */

test.use({ locale: "de" });

test("R-02: a shift over 10 hours shows a Verstoß and is still saved", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  await planen(page, ort, ab(1), "06:00", "17:30", 45);
  const eintrag = await befundZeigt(page, ab(1), "R-02", t("plan_regel_r02"), ort);
  await expect(eintrag).toContainText(t("befund_verstoss"));
  await expect(eintrag).toContainText("§ 3 Satz 2 ArbZG");
});

test("R-03: two long days from the start of the 24 weeks set in the settings", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  await page.goto("/einstellungen");
  await page.getByLabel(t("pruefung_ausgleich")).selectOption({
    label: t("pruefung_ausgleich_24_wochen"),
  });
  await page.getByLabel(t("pruefung_beginn")).fill(ab(0));
  await page.getByRole("button", { name: t("pruefung_speichern") }).click();
  await expect(page.getByText(t("pruefung_gespeichert"))).toBeVisible();
  await planen(page, ort, ab(0), "07:00", "17:45", 45);
  await planen(page, ort, ab(1), "07:00", "17:45", 45);
  await befundZeigt(page, ab(1), "R-03", t("plan_regel_r03"), ort);
});

test("R-04: seven hours without a break", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  await planen(page, ort, ab(2), "08:00", "15:00");
  const eintrag = await befundZeigt(page, ab(2), "R-04", t("plan_regel_r04"), ort);
  await expect(eintrag).toContainText("§ 4 Satz 1 ArbZG");
});

test("R-05: ten hours between a late and an early shift", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  await planen(page, ort, ab(0), "14:00", "22:00", 30);
  await planen(page, ort, ab(1), "08:00", "12:00");
  await befundZeigt(page, ab(1), "R-05", t("plan_regel_r05"), ort);
});

test("R-06: a night of more than 8 hours in Wechselschicht", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  await angabenSetzen(page, ort.nutzerId, { wechselschicht: true });
  await planen(page, ort, ab(1), "22:00", "08:00", 45);
  await befundZeigt(page, ab(1), "R-06", t("plan_regel_r06"), ort);
});

test("R-07: a Sunday without an exception, none with § 10 Abs. 1 Nr. 4 ArbZG", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  await planen(page, ort, ab(6), "10:00", "16:00");
  await befundZeigt(page, ab(6), "R-07", t("plan_regel_r07"), ort);
  await senden(page, "PUT", "/api/v1/betrieb/pruefung", {
    branche: "gastronomie_beherbergung",
    sonntagsausnahme: 4,
    ausgleichszeitraum: null,
    ausgleichBeginn: null,
  });
  await page.reload();
  await expect(hinweise(page)).toContainText(t("plan_befunde_keine"));
});

test("R-08: the 37th Sunday of next year leaves no further one", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  const jahr = Number(heute().slice(0, 4)) + 1;
  const erster = `${jahr}-01-01`;
  const ersterSonntag = plus(erster, (7 - new Date(`${erster}T12:00:00Z`).getUTCDay()) % 7);
  const sonntage = Array.from({ length: 37 }, (_, index) => plus(ersterSonntag, index * 7));
  await senden(page, "PUT", "/api/v1/betrieb/pruefung", {
    branche: null,
    sonntagsausnahme: 4,
    ausgleichszeitraum: null,
    ausgleichBeginn: null,
  });
  for (const sonntag of sonntage) await planen(page, ort, sonntag, "10:00", "14:00");
  await befundZeigt(page, sonntage[36] ?? "", "R-08", t("plan_regel_r08"), ort);
});

test("R-09: a Sunday with every Werktag of the two weeks before planned", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  await senden(page, "PUT", "/api/v1/betrieb/pruefung", {
    branche: null,
    sonntagsausnahme: 4,
    ausgleichszeitraum: null,
    ausgleichBeginn: null,
  });
  const werktage = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12].map(ab);
  for (const tag of werktage) await planen(page, ort, tag, "08:00", "12:00");
  await planen(page, ort, ab(13), "08:00", "12:00");
  await befundZeigt(page, ab(13), "R-09", t("plan_regel_r09"), ort);
});

test("R-14: a monthly wage below the minimum wage for the planned hours", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  await modellMitLohn(page, ort.nutzerId, { lohnArt: "monat", lohnCent: 100, minijob: false });
  await planen(page, ort, ab(1), "08:00", "12:00");
  await befundZeigt(page, ab(1), "R-14", t("plan_regel_r14"), ort);
});

test("R-32: a mini-job month over the limit with the plan", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  await modellMitLohn(page, ort.nutzerId, { lohnArt: "stunde", lohnCent: 100_000, minijob: true });
  await planen(page, ort, ab(1), "08:00", "12:00");
  await befundZeigt(page, ab(1), "R-32", t("plan_regel_r32"), ort);
});

test("R-22: a draft of tomorrow for a person on call, as a Hinweis", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  await angabenSetzen(page, ort.nutzerId, { abruf: true });
  const morgen = plus(heute(), 1);
  await planen(page, ort, morgen, "10:00", "16:00");
  const eintrag = await befundZeigt(page, morgen, "R-22", t("plan_regel_r22"), ort);
  await expect(eintrag).toContainText(t("befund_hinweis"));
  await expect(eintrag).toContainText("§ 12 Abs. 3 Satz 2 TzBfG");
});

test("shows a finding on the phone in the day's list @phone", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  await planen(page, ort, ab(2), "08:00", "15:00");
  await page.setViewportSize({ width: 412, height: 839 });
  await page.goto(`/dienstplan?tag=${ab(2)}`);
  await page
    .getByRole("group", { name: t("plan_tag") })
    .getByRole("button")
    .nth(2)
    .click();
  const eintrag = page.getByRole("button", { name: /Jonas Weber.*08:00–15:00/ });
  await expect(eintrag).toContainText(t("plan_regel_r04"));
  await expect(eintrag).toContainText("§ 4 Satz 1 ArbZG");
  await expect(hinweise(page).locator('[data-regel="R-04"]').first()).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`axe finds nothing on a plan with findings and the data dialog in ${theme} @phone`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    const ort = await betriebMitPlan(page);
    await planen(page, ort, ab(1), "06:00", "17:30", 45);
    await planen(page, ort, ab(3), "08:00", "15:00");
    await page.goto(`/dienstplan?tag=${ab(1)}`);
    await expect(hinweise(page).locator("[data-regel]").first()).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await planAktion(page, t("plan_angaben"));
    await expect(page.getByRole("dialog", { name: t("plan_angaben") })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
