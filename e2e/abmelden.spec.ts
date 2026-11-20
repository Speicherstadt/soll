import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

test("signing out leads to the sign-in, and the session is gone after a reload @phone", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/einstellungen");
  await page.getByRole("button", { name: t("abmelden") }).click();
  await expect(page).toHaveURL(/\/anmelden$/);
  await page.goto("/einstellungen");
  await expect(page).toHaveURL(/\/anmelden$/);
});

test("a sign-out the server never got says so and does not show the sign-in @phone", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/einstellungen");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // the connection drops: neither the sign-out nor the question after it reaches the server
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => route.abort("internetdisconnected"),
  );
  await page.getByRole("button", { name: t("abmelden") }).click();
  await expect(page.getByText(t("fehler_netz"))).toBeVisible();
  await expect(page).toHaveURL(/\/einstellungen$/);
  // the session was never ended: back online, the person is still signed in
  await page.unrouteAll();
  await page.goto("/einstellungen");
  await expect(page).toHaveURL(/\/einstellungen$/);
});
