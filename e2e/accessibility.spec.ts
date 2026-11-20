import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Every page of the route tree, in both themes, opened and checked with axe (the `pages` check reads
// this list: "/", "/zeiten", "/abwesenheiten", "/dienstplan", "/projekte", "/auswertungen",
// "/einstellungen", "/mehr")
const pages = [
  "/",
  "/zeiten",
  "/abwesenheiten",
  "/dienstplan",
  "/projekte",
  "/auswertungen",
  "/einstellungen",
  "/mehr",
];

for (const theme of ["light", "dark"] as const) {
  for (const path of pages) {
    test(`axe finds nothing on ${path} in ${theme} @phone @terminal`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
