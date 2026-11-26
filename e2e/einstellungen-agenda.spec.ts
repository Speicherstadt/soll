import { expect, test } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, zweiterBrowser } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

test("settings agenda only links to sections visible to an employee", async ({
  page,
  browser,
}, info) => {
  await betriebAnlegen(page);
  const sandra = await zweiterBrowser(browser, info);
  try {
    await einladungAnnehmen(page, sandra, "Sandra Kühn");
    await sandra.goto("/einstellungen");
    await expect(
      sandra.getByRole("heading", { level: 1, name: t("nav_einstellungen") }),
    ).toBeVisible();
    await expect(sandra.getByRole("heading", { level: 2, name: t("module_titel") })).toBeVisible();

    const agenda = sandra.getByRole("navigation", { name: t("nav_einstellungen") });
    await expect(agenda).toBeVisible();
    for (const link of await agenda.getByRole("link").all()) {
      const href = await link.getAttribute("href");
      expect(href).toMatch(/^#/);
      const target = sandra.locator(href as string);
      await expect(
        target.getByRole("heading").first(),
        `agenda link ${href} points to an empty or hidden section`,
      ).toBeVisible();
    }
  } finally {
    await sandra.context().close();
  }
});
