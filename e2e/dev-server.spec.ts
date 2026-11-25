import { expect, test } from "@playwright/test";

// The dev server and the production build (for the preview server, playwright.config.ts) both let
// Paraglide compile into apps/web/src/paraglide, in a different layout each (apps/web/vite.config.ts).
// A build that runs while the dev server is up rewrites those files under it; Vite then reloads
// every page and stamps each invalidated module with `?t=`, so from then on every fresh browser
// fetches the app's modules anew, and pages in parallel tests took longer than a test may run. Vite
// stamps nothing that has not changed since it started.
test("the build for the preview server has not reloaded the dev server", async ({ page }) => {
  const stamped: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).searchParams.has("t")) stamped.push(request.url());
  });
  await page.goto("/anmelden");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(stamped).toEqual([]);
});

// Paraglide's default layout for Vite gives every message its own module: a fresh page on the dev
// server fetched some 1250 of them (of about 1500 requests), and under four workers some page loads
// took longer than a test may run. In development the texts come one module per language
// (`locale-modules`, apps/web/vite.config.ts; docs/plan.md, "Entscheidungen"), a handful of files
// however many texts the app has.
test("the dev server serves the texts in a handful of modules, not one per message", async ({
  page,
}) => {
  const texts: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("paraglide")) texts.push(request.url());
  });
  await page.goto("/anmelden");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // runtime, registry, messages, the index and one module per language (six): 10 today
  expect(texts.length).toBeLessThanOrEqual(20);
});
