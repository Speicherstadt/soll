import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Every page of the route tree, opened and checked with axe (the `pages` check reads this list)
const pages = ["/"];

for (const path of pages) {
  test(`axe finds nothing on ${path} @phone @terminal`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
