import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";

// The built app with its service worker, served by `vite preview` (playwright.config.ts, PREVIEW_PORT)
const preview = "http://localhost:5179";

test("the built app opens again without a network", async ({ page, context }) => {
  // signed in through the dev server; the session cookie holds for localhost on every port
  await betriebAnlegen(page);
  await page.goto(`${preview}/`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
