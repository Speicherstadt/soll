import { expect, test } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, zweiterBrowser } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

test("settings tabs only show sections visible to an employee and switch cleanly", async ({
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

    const tablist = sandra.getByRole("tablist", { name: t("nav_einstellungen") });
    await expect(tablist).toBeVisible();
    // Employee sees Betrieb and Konto tabs, not owner-only Export & Umzug or Terminal
    await expect(tablist.getByRole("tab", { name: t("einstellungen_tab_betrieb") })).toBeVisible();
    await expect(tablist.getByRole("tab", { name: t("einstellungen_tab_konto") })).toBeVisible();
    await expect(tablist.getByRole("tab", { name: t("einstellungen_tab_export") })).toHaveCount(0);
    await expect(tablist.getByRole("tab", { name: t("einstellungen_tab_terminal") })).toHaveCount(
      0,
    );

    await expect(sandra.getByRole("heading", { level: 2, name: t("module_titel") })).toBeVisible();

    await tablist.getByRole("tab", { name: t("einstellungen_tab_konto") }).click();
    await expect(sandra.getByRole("heading", { level: 2, name: t("konto_titel") })).toBeVisible();
    await expect(
      sandra.getByRole("heading", { level: 2, name: t("darstellung_titel") }),
    ).toBeVisible();
  } finally {
    await sandra.context().close();
  }
});
