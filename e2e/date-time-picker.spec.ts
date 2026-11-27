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
  await popover.getByRole("button", { name: "15", exact: true }).first().click();
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

  // Re-open and pick 09:30
  await vonInput.click();
  await expect(popover).toBeVisible();
  const spalten = popover.locator("> div");
  await spalten.nth(0).getByRole("button", { name: "09", exact: true }).click();
  await spalten.nth(1).getByRole("button", { name: "30", exact: true }).click();
  await expect(popover).toBeHidden();
  await expect(vonInput).toHaveValue("09:30");
});
