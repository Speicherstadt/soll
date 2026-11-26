import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

const kontoOeffnen = async (page: import("@playwright/test").Page) => {
  await page.goto("/einstellungen");
  await page.getByRole("tab", { name: t("einstellungen_tab_konto") }).click();
};

test("signing out leads to the sign-in, and the session is gone after a reload @phone", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await kontoOeffnen(page);
  await page.getByRole("button", { name: t("abmelden") }).click();
  await expect(page).toHaveURL(/\/anmelden$/);
  await page.goto("/einstellungen");
  await expect(page).toHaveURL(/\/anmelden$/);
});

test("a sign-out the server never got says so and does not show the sign-in @phone", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await kontoOeffnen(page);
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

test("a sign-out the server got clears the business on the device, even if the next question fails @phone", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await kontoOeffnen(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("soll.betrieb"))).not.toBeNull();
  // the sign-out reaches the server, then the connection drops before the session is asked again
  await page.route(
    (url) => url.pathname.startsWith("/api/") && url.pathname !== "/api/auth/sign-out",
    (route) => route.abort("internetdisconnected"),
  );
  await page.getByRole("button", { name: t("abmelden") }).click();
  await expect(page).toHaveURL(/\/anmelden$/);
  expect(await page.evaluate(() => localStorage.getItem("soll.betrieb"))).toBeNull();
  // the next person on this device, still offline, sees nothing of the previous business
  await page.goto("/einstellungen");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Weber Haustechnik")).toHaveCount(0);
});

test("a sign-out the server refused says so and does not pretend @phone", async ({ page }) => {
  await betriebAnlegen(page);
  await kontoOeffnen(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.route("**/api/auth/sign-out", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await page.getByRole("button", { name: t("abmelden") }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/einstellungen$/);
});

test("a double click on Abmelden lands on the sign-in without an error @phone", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await kontoOeffnen(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: t("abmelden") }).dblclick();
  await expect(page).toHaveURL(/\/anmelden$/);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.goto("/einstellungen");
  await expect(page).toHaveURL(/\/anmelden$/);
});
