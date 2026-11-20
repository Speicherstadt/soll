import { expect, test } from "@playwright/test";
import { locales, messagesOf } from "./locales.ts";

for (const locale of locales) {
  test.describe(`start page in ${locale}`, () => {
    test.use({ locale });

    test(`renders in ${locale} @phone @terminal`, async ({ page }) => {
      await page.goto("/");
      const messages = messagesOf(locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.start_title ?? "");
      await expect(page.getByText(messages.start_tagline ?? "")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    });
  });
}
