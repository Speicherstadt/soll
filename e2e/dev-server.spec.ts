import { expect, test } from "@playwright/test";

// The dev server and the production build (for the preview server, playwright.config.ts) both let
// Paraglide compile into apps/web/src/paraglide, with `isDevelopment` true for the one and false for
// the other. A build that runs while the dev server is up rewrites runtime.js under it; Vite then
// reloads every page and stamps each invalidated module with `?t=`, so from then on every fresh
// browser fetches the app's thousand-odd message modules anew, and pages in parallel tests took
// longer than a test may run. Vite stamps nothing that has not changed since it started.
test("the build for the preview server has not reloaded the dev server", async ({ page }) => {
  const stamped: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).searchParams.has("t")) stamped.push(request.url());
  });
  await page.goto("/anmelden");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(stamped).toEqual([]);
});
