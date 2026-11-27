import { expect, test } from "@playwright/test";
import { betriebAnlegen, senden } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de", viewport: { width: 1440, height: 1000 } });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

test("Dienstplan switches cleanly between Day, Week, Month and TV Fullscreen modes", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await senden(page, "POST", "/api/v1/standorte", { name: "Elbe", land: "HH" });
  await page.goto("/dienstplan");

  const ansicht = page.getByRole("group", { name: t("plan_ansicht") });
  await expect(ansicht).toBeVisible();

  // Switch to Day timeline view
  await ansicht.getByRole("button", { name: t("plan_ansicht_tag"), exact: true }).click();
  await expect(page.getByText("06:00")).toBeVisible();

  // Switch to Month calendar view with Person filter
  await ansicht.getByRole("button", { name: t("plan_ansicht_monat"), exact: true }).click();
  await expect(page.getByLabel(t("plan_filter_person"))).toBeVisible();

  // Switch back to Week and enter/exit TV Fullscreen via Escape
  await ansicht.getByRole("button", { name: t("plan_ansicht_woche"), exact: true }).click();
  await page.getByRole("button", { name: t("plan_vollbild"), exact: true }).click();
  await expect(page.getByRole("button", { name: t("plan_vollbild_beenden") })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: t("plan_vollbild"), exact: true })).toBeVisible();
});

test("Dienstplan prints visibly with dark ink even from dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await betriebAnlegen(page);
  await senden(page, "POST", "/api/v1/standorte", { name: "Elbe", land: "HH" });
  await page.goto("/dienstplan");
  await expect(page.locator("main table")).toBeVisible();

  await page.emulateMedia({ media: "print" });
  const printState = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const tbl = document.querySelector("main table");
    return {
      h1Visibility: h1 ? getComputedStyle(h1).visibility : null,
      h1Color: h1 ? getComputedStyle(h1).color : null,
      tblVisibility: tbl ? getComputedStyle(tbl).visibility : null,
    };
  });
  expect(printState.h1Visibility).toBe("visible");
  expect(printState.tblVisibility).toBe("visible");
  expect(printState.h1Color).toBe("rgb(9, 9, 11)");
});

// tdd-review: body:has([data-druck]) matches the closed <dialog> of AusweisDialog on /einstellungen
test("Terminal settings page prints visibly when the QR card dialog is closed", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/einstellungen");
  await page.getByRole("tab", { name: t("einstellungen_tab_terminal") }).click();
  await expect(page.getByRole("heading", { name: t("terminal_personen_titel") })).toBeVisible();

  await page.emulateMedia({ media: "print" });
  const closedState = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    return {
      h1Visibility: h1 ? getComputedStyle(h1).visibility : null,
    };
  });
  expect(closedState.h1Visibility).toBe("visible");

  await page.emulateMedia({ media: "screen" });
  await page
    .getByRole("button", {
      name: t("terminal_qr_ausstellen_name").replace("{name}", "Jonas Weber"),
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.emulateMedia({ media: "print" });
  const openState = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const card = document.querySelector("[data-druck]");
    return {
      h1Visibility: h1 ? getComputedStyle(h1).visibility : null,
      cardVisibility: card ? getComputedStyle(card).visibility : null,
    };
  });
  expect(openState.h1Visibility).toBe("hidden");
  expect(openState.cardVisibility).toBe("visible");
});
