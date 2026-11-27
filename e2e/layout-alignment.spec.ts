import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de", viewport: { width: 1440, height: 1000 } });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

test("side-by-side cards share exact top and bottom edges on Abwesenheiten and Zeiten/Monat switcher works", async ({
  page,
}) => {
  await betriebAnlegen(page);

  // Abwesenheiten: Row 1 (Teamkalender + Urlaub beantragen) & Row 2 (Meine Abwesenheiten + Krank melden)
  await page.goto("/abwesenheiten");
  const team = await page.getByRole("region", { name: t("abw_team_titel") }).boundingBox();
  const antrag = await page.getByRole("region", { name: t("abw_antrag_titel") }).boundingBox();
  const meine = await page.getByRole("region", { name: t("abw_meine_titel") }).boundingBox();
  const krank = await page.getByRole("region", { name: t("abw_krank_titel") }).boundingBox();

  expect(team && antrag && meine && krank).toBeTruthy();
  if (team && antrag && meine && krank) {
    expect(Math.abs(team.y - antrag.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(team.y + team.height - (antrag.y + antrag.height))).toBeLessThanOrEqual(1);
    expect(Math.abs(meine.y - krank.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(meine.y + meine.height - (krank.y + krank.height))).toBeLessThanOrEqual(1);
  }

  // Zeiten <-> Monat switcher inside main content navigates back and forth cleanly
  await page.goto("/zeiten");
  await page
    .getByRole("main")
    .getByRole("link", { name: t("monat_titel") })
    .click();
  await expect(page).toHaveURL(/\/monat$/);
  await page
    .getByRole("main")
    .getByRole("link", { name: t("nav_zeiten") })
    .click();
  await expect(page).toHaveURL(/\/zeiten$/);
});
