import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { abmelden, betriebAnlegen, einladungsLink, kontoAnlegen } from "./betrieb.ts";

// Every page of the route tree, in both themes, opened and checked with axe (the `pages` check reads
// the paths in this file). The areas need a signed-in owner of a business with every module.
const pages = [
  "/",
  "/zeiten",
  "/abwesenheiten",
  "/dienstplan",
  "/projekte",
  "/auswertungen",
  "/einstellungen",
  "/mehr",
  "/monat",
];

const pruefen = async (page: Page) => {
  await expect(page.locator("main")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
};

for (const theme of ["light", "dark"] as const) {
  test.describe(`in ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
    });

    for (const path of pages) {
      test(`axe finds nothing on ${path} @phone @terminal`, async ({ page }) => {
        await betriebAnlegen(page);
        await page.goto(path);
        await expect(page).toHaveURL(path);
        await pruefen(page);
      });
    }

    // Without a session: signing in and up, and the check page of a Prüfwert
    for (const path of ["/anmelden", "/registrieren", "/pruefen"]) {
      test(`axe finds nothing on ${path} @phone`, async ({ page }) => {
        await page.goto(path);
        await pruefen(page);
      });
    }

    test("axe finds nothing on /einrichtung @phone", async ({ page }) => {
      await kontoAnlegen(page);
      await page.goto("/einrichtung");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await pruefen(page);
    });

    test("axe finds nothing on an invitation @phone", async ({ page }) => {
      await betriebAnlegen(page);
      const token = (await einladungsLink(page, "Sandra Kühn")).split("/").pop();
      await abmelden(page);
      await page.goto(`/einladung/${token}`);
      await expect(page.getByRole("textbox").first()).toBeVisible();
      await pruefen(page);
    });
  });
}
