import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de", viewport: { width: 1440, height: 1000 } });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

test("[tdd-review] KorrekturDialog TimePicker keeps picked hour when minute is clicked (value vs defaultValue)", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/zeiten");

  await page.getByRole("button", { name: t("nachtragen") }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const uhrzeit = dialog.getByLabel(t("korrektur_uhrzeit"), { exact: true });
  await uhrzeit.click();
  const popover = dialog.locator('[data-picker-popover="time"]');
  await expect(popover).toBeVisible();

  await popover.getByRole("button", { name: "+01:00", exact: true }).click();
  await popover.getByRole("button", { name: ":30", exact: true }).click();
  await expect(uhrzeit).toHaveValue("09:30");
});

test("[tdd-review] BuchungDialog TimePicker keeps picked hour when minute is clicked (value vs defaultValue)", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/");

  await page.getByRole("button", { name: t("buchung_nachtragen") }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const beginn = dialog.getByLabel(t("buchung_beginn"), { exact: true });
  await beginn.click();
  const popover = dialog.locator('[data-picker-popover="time"]');
  await expect(popover).toBeVisible();

  await popover.getByRole("button", { name: "+01:00", exact: true }).click();
  await popover.getByRole("button", { name: ":30", exact: true }).click();
  await expect(beginn).toHaveValue("09:30");
});

test("[tdd-review] form.reset() restores DatePicker defaultValue instead of clearing the input", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/abwesenheiten");

  const start = page.getByLabel(t("abw_von"), { exact: true });
  await expect(start).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  const initial = await start.inputValue();

  // Resetting when unchanged must keep defaultValue (not clear to "")
  await start.evaluate((el) => (el as HTMLInputElement).form?.reset());
  await expect(start).toHaveValue(initial);

  // Resetting after editing must also restore defaultValue
  await start.fill("2026-12-24");
  await expect(start).toHaveValue("2026-12-24");
  await start.evaluate((el) => (el as HTMLInputElement).form?.reset());
  await expect(start).toHaveValue(initial);
});

test("[tdd-review] DatePicker and TimePicker attach form reset listener via onSettled and remove it on unmount", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __resetAdded: number; __resetRemoved: number };
    w.__resetAdded = 0;
    w.__resetRemoved = 0;
    const origAdd = HTMLFormElement.prototype.addEventListener;
    const origRemove = HTMLFormElement.prototype.removeEventListener;
    HTMLFormElement.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type === "reset") w.__resetAdded++;
      return origAdd.call(this, type, listener, options);
    };
    HTMLFormElement.prototype.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) {
      if (type === "reset") w.__resetRemoved++;
      return origRemove.call(this, type, listener, options);
    };
  });

  await betriebAnlegen(page);
  await page.goto("/zeiten");

  await page.getByRole("button", { name: t("nachtragen") }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: t("abbrechen") }).click();
  await expect(dialog).toBeHidden();

  const counts = await page.evaluate(() => {
    const w = window as unknown as { __resetAdded: number; __resetRemoved: number };
    return { added: w.__resetAdded, removed: w.__resetRemoved };
  });
  expect(counts.added).toBeGreaterThanOrEqual(2);
  expect(counts.removed).toBe(counts.added);
});

test("[tdd-review] DatePicker renders 7 distinct weekday headers in Arabic (RTL)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "ar",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const ar = messagesOf("ar");
  const tAr = (key: string) => ar[key] ?? key;

  await betriebAnlegen(page);
  await page.goto("/zeiten");

  const datumInput = page.getByLabel(tAr("zeiten_datum"), { exact: true });
  await datumInput.click();
  const popover = page.locator('[data-picker-popover="date"]');
  await expect(popover).toBeVisible();

  const headers = await popover
    .locator(".grid.grid-cols-7")
    .first()
    .locator("span")
    .allTextContents();
  expect(headers).toHaveLength(7);
  expect(new Set(headers).size).toBe(7);

  await context.close();
});

test("[tdd-review] DatePicker enforces min/max and YYYY-MM-DD format in constraint validation", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/abwesenheiten");

  const bis = page.getByLabel(t("abw_krank_bis"), { exact: true });
  await bis.fill("2020-01-01");
  const validBeforeMin = await bis.evaluate((el) => (el as HTMLInputElement).checkValidity());
  expect(validBeforeMin).toBe(false);

  await bis.fill("not-a-date");
  const validGarbage = await bis.evaluate((el) => (el as HTMLInputElement).checkValidity());
  expect(validGarbage).toBe(false);
});

test("[tdd-review] DatePicker month navigation buttons have descriptive accessible names instead of bare punctuation", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/zeiten");

  const datumInput = page.getByLabel(t("zeiten_datum"), { exact: true });
  await datumInput.click();
  const popover = page.locator('[data-picker-popover="date"]');
  await expect(popover).toBeVisible();

  const navButtons = popover.locator("> div").first().locator("button");
  await expect(navButtons).toHaveCount(2);
  const prevLabel = (await navButtons.nth(0).getAttribute("aria-label")) ?? "";
  const nextLabel = (await navButtons.nth(1).getAttribute("aria-label")) ?? "";
  expect(prevLabel).not.toBe("‹");
  expect(nextLabel).not.toBe("›");
  expect(prevLabel.length).toBeGreaterThan(2);
  expect(nextLabel.length).toBeGreaterThan(2);
});
