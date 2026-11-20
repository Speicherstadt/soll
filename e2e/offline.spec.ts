import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";

test.use({ locale: "de" });

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

test("opens Heute without a network with the day last seen and stamps into the queue", async ({
  page,
  context,
}) => {
  await betriebAnlegen(page);
  await page.goto(`${preview}/`);
  const kommen = page.getByRole("button", { name: "Kommen", exact: true });
  // the day is loaded once with the network, and kept on the device
  await expect(kommen).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(kommen).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(kommen).toBeVisible();
  await kommen.click();
  await expect(page.getByTestId("zustand")).toHaveText(/^Eingestempelt seit \d\d:\d\d$/);
  await expect(page.getByTestId("wartend")).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByTestId("wartend")).toBeHidden({ timeout: 40_000 });
  const tag = await (await page.request.get(`${preview}/api/v1/arbeitszeit/tag`)).json();
  expect(tag.stempelungen).toMatchObject([{ art: "kommen", offline: true, nummer: 1 }]);
});
