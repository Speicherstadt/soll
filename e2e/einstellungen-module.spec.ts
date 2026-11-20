import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

test("switching two modules quickly keeps both off, whatever answer comes last", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/einstellungen");
  const dienstplan = page.getByRole("checkbox", { name: t("modul_dienstplan") });
  const projektzeit = page.getByRole("checkbox", { name: t("modul_projektzeit") });
  await expect(projektzeit).toBeChecked();
  // the session asked after the first switch is read before the second and answers after it
  let freigeben = () => {};
  const frei = new Promise<void>((resolve) => {
    freigeben = resolve;
  });
  let beantwortet: Promise<void> = Promise.resolve();
  const pfad = (url: URL) => url.pathname === "/api/v1/betrieb";
  let gehalten = false;
  await page.route(pfad, async (route) => {
    if (route.request().method() !== "GET" || gehalten) return route.continue();
    gehalten = true;
    const antwort = await route.fetch();
    beantwortet = frei.then(() => route.fulfill({ response: antwort }));
  });
  const zweiteAntwort = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/v1/betrieb" && r.request().method() === "GET",
  );
  await dienstplan.uncheck();
  await page.waitForTimeout(200);
  await projektzeit.uncheck();
  await zweiteAntwort;
  await expect(projektzeit).not.toBeChecked();
  freigeben();
  await beantwortet;
  await page.waitForTimeout(200);
  await expect(dienstplan).not.toBeChecked();
  await expect(projektzeit).not.toBeChecked();
  await expect(page.getByRole("link", { name: t("nav_projekte") })).toHaveCount(0);
});
