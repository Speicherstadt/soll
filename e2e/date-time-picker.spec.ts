import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { betriebAnlegen, senden } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de", viewport: { width: 1440, height: 1000 } });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

test("DatePicker opens shadcn calendar popover, selects dates, and has 0 axe violations", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/zeiten");

  const datumInput = page.getByLabel(t("zeiten_datum"), { exact: true });
  await expect(datumInput).toBeVisible();
  // Never renders native browser date/time inputs
  await expect(page.locator('input[type="date"], input[type="time"]')).toHaveCount(0);

  await datumInput.click();
  const popover = page.locator('[data-picker-popover="date"]');
  await expect(popover).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);

  // Pick day 15 of the visible month and verify the input updates to YYYY-MM-15
  await popover.getByRole("button", { name: /\b15\./ }).first().click();
  await expect(popover).toBeHidden();
  await expect(datumInput).toHaveValue(/^\d{4}-\d{2}-15$/);

  // Re-open and close with Escape
  await datumInput.click();
  await expect(popover).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
});

test("TimePicker works inside a modal Dialog without clipping and Escape keeps the dialog open", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await senden(page, "POST", "/api/v1/standorte", { name: "Elbe", land: "HH" });
  await page.goto("/dienstplan");

  await page.locator("main table tbody button").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input[type="date"], input[type="time"]')).toHaveCount(0);

  const vonInput = dialog.getByLabel(t("plan_beginn"), { exact: true });
  await vonInput.click();
  const popover = dialog.locator('[data-picker-popover="time"]');
  await expect(popover).toBeVisible();

  // Escape closes only the time popover, leaving the modal dialog open
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(dialog).toBeVisible();

  // Re-open, verify 0 axe violations, step hour +1 (08->09) and pick :30
  await vonInput.click();
  await expect(popover).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  await popover.getByRole("button", { name: "Stunde +1", exact: true }).click();
  await popover.getByRole("button", { name: ":30", exact: true }).click();
  await expect(vonInput).toHaveValue("09:30");
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
});

test("Stoppuhr Starten and Stoppen cause zero vertical layout shift on Heute", async ({ page }) => {
  await betriebAnlegen(page);
  await page.goto("/");

  const bereich = page.getByRole("region", { name: t("stoppuhr_titel") });
  const form = bereich.getByRole("form", { name: t("stoppuhr_neu") });
  await expect(form).toBeVisible();

  const before = await form.boundingBox();
  expect(before).not.toBeNull();

  await form.getByRole("button", { name: t("stoppuhr_starten") }).click();
  await expect(bereich.getByTestId("stoppuhr-laufend")).toBeVisible();

  const afterStart = await form.boundingBox();
  expect(afterStart).not.toBeNull();
  expect(Math.abs((afterStart?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1);

  await bereich.getByRole("button", { name: t("stoppuhr_stoppen") }).click();
  await expect(bereich.getByText(t("stoppuhr_steht"))).toBeVisible();

  const afterStop = await form.boundingBox();
  expect(Math.abs((afterStop?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1);
});
