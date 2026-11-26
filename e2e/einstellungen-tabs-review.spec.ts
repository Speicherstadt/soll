import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

// Review finding: toggling a module triggers sitzungNeu(), which recreates the Tab objects in
// apps/web/src/routes/einstellungen.tsx and causes <For each={props.tabs}> in packages/ui/src/tabs.tsx
// to unmount and remount the active tabpanel, wiping out unsaved edits in PruefungEinstellungen once
// the session refresh settles.
test("review: toggling a module keeps unsaved Pruefung edits after session refresh settles", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/einstellungen");
  await expect(page.getByRole("heading", { level: 1, name: t("nav_einstellungen") })).toBeVisible();
  const branche = page.getByLabel(t("pruefung_branche"));
  await branche.selectOption({ label: t("branche_verkehr") });

  await page.getByRole("checkbox", { name: t("modul_projektzeit") }).uncheck();
  // Wait until sitzungNeu() has actually flushed into Solid (nav_projekte disappears)
  await expect(page.getByRole("link", { name: t("nav_projekte") })).toHaveCount(0);

  await expect(branche).toHaveValue("verkehr");
});
