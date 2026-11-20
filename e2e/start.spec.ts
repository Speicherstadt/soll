import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { locales, messagesOf } from "./locales.ts";

for (const locale of locales) {
  test.describe(`start page in ${locale}`, () => {
    test.use({ locale });

    test(`renders in ${locale} @phone @terminal`, async ({ page }) => {
      await betriebAnlegen(page);
      await page.goto("/");
      const messages = messagesOf(locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.nav_heute ?? "");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    });
  });
}
