import { expect, type Page, test } from "@playwright/test";
import { ab, angabenSetzen, befundZeigt, betriebMitPlan, heute, planen, t } from "./plan.ts";

/*
 * The JArbSchG (R-15 to R-20) and the MuSchG (R-21) in the plan (BAULISTE.md S-502), with the data
 * only the owner enters: a birth date 17 years ago, a span of the Mutterschutz from today.
 */

test.use({ locale: "de" });

/** A birth date that makes the person 17 for the next months */
const siebzehn = () => {
  const [jahr = 0, monat = "01", tag = "01"] = heute().split("-");
  return `${Number(jahr) - 17}-${monat}-${tag}`;
};

/** The owner enters the birth date in the plan's dialog, as a person would */
const jugendlich = async (page: Page) => {
  const ort = await betriebMitPlan(page);
  await page.goto(`/dienstplan?tag=${ab(0)}`);
  await page.getByRole("button", { name: t("plan_angaben"), exact: true }).click();
  const dialog = page.getByRole("dialog", { name: t("plan_angaben") });
  await dialog.getByLabel(t("plan_person")).selectOption({ label: "Jonas Weber" });
  await dialog.getByLabel(t("plan_angaben_geburtsdatum")).fill(siebzehn());
  await dialog.getByRole("button", { name: t("plan_speichern") }).click();
  await expect(dialog.getByText(t("plan_angaben_gespeichert"))).toBeVisible();
  await dialog.getByRole("button", { name: t("plan_schliessen") }).click();
  return ort;
};

test("R-15: a Jugendlicher planned for 8:30 hours", async ({ page }) => {
  const ort = await jugendlich(page);
  await planen(page, ort, ab(1), "07:00", "16:30", 60);
  const eintrag = await befundZeigt(page, ab(1), "R-15", t("plan_regel_r15"), ort);
  await expect(eintrag).toContainText("JArbSchG");
});

test("R-16: a Jugendlicher with 6:30 hours and 30 minutes of break", async ({ page }) => {
  const ort = await jugendlich(page);
  await planen(page, ort, ab(1), "08:00", "15:00", 30);
  await befundZeigt(page, ab(1), "R-16", t("plan_regel_r16"), ort);
});

test("R-17: a Jugendlicher with a shift span of 11 hours", async ({ page }) => {
  const ort = await jugendlich(page);
  await planen(page, ort, ab(1), "07:00", "18:00", 180);
  await befundZeigt(page, ab(1), "R-17", t("plan_regel_r17"), ort);
});

test("R-18: a Jugendlicher with 11 hours off between two days", async ({ page }) => {
  const ort = await jugendlich(page);
  await planen(page, ort, ab(1), "12:00", "20:00", 60);
  await planen(page, ort, ab(2), "07:00", "14:00", 60);
  await befundZeigt(page, ab(2), "R-18", t("plan_regel_r18"), ort);
});

test("R-19: a Jugendlicher planned until 21:00", async ({ page }) => {
  const ort = await jugendlich(page);
  await planen(page, ort, ab(1), "14:00", "21:00", 60);
  await befundZeigt(page, ab(1), "R-19", t("plan_regel_r19"), ort);
});

test("R-20: a Jugendlicher planned on a Saturday", async ({ page }) => {
  const ort = await jugendlich(page);
  await planen(page, ort, ab(5), "08:00", "12:00");
  await befundZeigt(page, ab(5), "R-20", t("plan_regel_r20"), ort);
});

test("R-21: nine hours in the span of the Mutterschutz", async ({ page }) => {
  const ort = await betriebMitPlan(page);
  await angabenSetzen(page, ort.nutzerId, { mutterschutz: [{ von: heute(), bis: null }] });
  await planen(page, ort, ab(1), "08:00", "17:30", 30);
  const eintrag = await befundZeigt(page, ab(1), "R-21", t("plan_regel_r21"), ort);
  await expect(eintrag).toContainText("MuSchG");
});
