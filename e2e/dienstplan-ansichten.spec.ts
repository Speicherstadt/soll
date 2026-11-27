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
