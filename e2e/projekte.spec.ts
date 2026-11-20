import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, senden, zweiterBrowser } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema, uebergaengeFertig } from "./thema.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

const feld = (page: Page, key: string) => page.getByLabel(t(key), { exact: true });

const tab = (page: Page, key: string) => page.getByRole("tab", { name: t(key) }).click();

test("the owner keeps customers, orders with a budget, activities and rates @phone", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/projekte");
  await expect(page.getByRole("heading", { level: 1, name: t("nav_projekte") })).toBeVisible();

  await tab(page, "projekte_tab_kunden");
  await feld(page, "kunde_name").fill("Elbhof");
  await feld(page, "kunde_nummer").fill("K-1001");
  await page.getByRole("button", { name: t("kunde_anlegen") }).click();
  await expect(page.getByRole("cell", { name: "Elbhof", exact: true })).toBeVisible();

  await tab(page, "projekte_tab_auftraege");
  await feld(page, "auftrag_kunde").selectOption({ label: "Elbhof" });
  await feld(page, "auftrag_name").fill("Bad Elbhof");
  await feld(page, "auftrag_budget_stunden").fill("40");
  await feld(page, "auftrag_budget_euro").fill("4.000");
  await page.getByRole("button", { name: t("auftrag_anlegen") }).click();
  const auftrag = page.getByRole("row", { name: /Bad Elbhof/ });
  await expect(auftrag).toContainText("40:00");
  await expect(auftrag).toContainText("4.000,00");
  await expect(auftrag).toContainText(t("budget_warnung_ab", { prozent: "80" }));

  await tab(page, "projekte_tab_taetigkeiten");
  for (const key of [
    "taetigkeit_fahrt",
    "taetigkeit_werkstatt",
    "taetigkeit_lager",
    "taetigkeit_schulung",
  ]) {
    const zeile = page.getByRole("row", { name: new RegExp(t(key)) });
    await expect(zeile).toContainText(t("taetigkeit_intern"));
    await expect(zeile.getByRole("button")).toHaveCount(0);
  }
  await feld(page, "taetigkeit_name").fill("Montage");
  await page.getByRole("button", { name: t("taetigkeit_anlegen") }).click();
  await expect(page.getByRole("cell", { name: "Montage", exact: true })).toBeVisible();

  await tab(page, "projekte_tab_saetze");
  await expect(page.getByText(t("saetze_leer"))).toBeVisible();
  await feld(page, "satz_taetigkeit").selectOption({ label: "Montage" });
  await feld(page, "satz_betrag").fill("85,00");
  await page.getByRole("button", { name: t("satz_anlegen") }).click();
  const satz = page.getByRole("row", { name: /Montage/ });
  await expect(satz).toContainText("85,00");

  // what a rate names is archived, not removed
  await tab(page, "projekte_tab_taetigkeiten");
  await page.getByRole("button", { name: t("entfernen", { name: "Montage" }) }).click();
  await expect(page.getByRole("alert")).toHaveText(t("fehler_verwendet"));
  await page.getByRole("button", { name: t("archivieren", { name: "Montage" }) }).click();
  await expect(page.getByRole("row", { name: /Montage/ })).toContainText(t("archiviert"));
  await page.getByRole("button", { name: t("zurueckholen", { name: "Montage" }) }).click();
  await expect(page.getByRole("row", { name: /Montage/ })).not.toContainText(t("archiviert"));

  for (const theme of ["light", "dark"] as const) {
    await thema(page, theme);
    for (const key of [
      "projekte_tab_auftraege",
      "projekte_tab_kunden",
      "projekte_tab_taetigkeiten",
      "projekte_tab_saetze",
    ]) {
      await tab(page, key);
      await uebergaengeFertig(page);
      expect((await new AxeBuilder({ page }).analyze()).violations, `${theme} ${key}`).toEqual([]);
    }
  }
});

test("an employee sees orders and activities, without money and without changing them @phone", async ({
  page,
  browser,
}) => {
  const jonas = await zweiterBrowser(browser, test.info());
  await betriebAnlegen(jonas);
  const kunde = await senden(jonas, "POST", "/api/v1/projektzeit/kunden", { name: "Elbhof" });
  await senden(jonas, "POST", "/api/v1/projektzeit/projekte", {
    kundeId: kunde.kundeId,
    name: "Bad Elbhof",
    budgetMinuten: 2_400,
    budgetCent: 400_000,
  });
  await einladungAnnehmen(jonas, page, "Max Brandt");
  await page.goto("/projekte");
  const auftrag = page.getByRole("row", { name: /Bad Elbhof/ });
  await expect(auftrag).toContainText("40:00");
  await expect(auftrag).not.toContainText("4.000");
  await expect(page.getByRole("tab", { name: t("projekte_tab_saetze") })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: t("projekte_tab_kunden") })).toHaveCount(0);
  await expect(page.getByRole("button", { name: t("auftrag_anlegen") })).toHaveCount(0);
  await tab(page, "projekte_tab_taetigkeiten");
  await expect(page.getByRole("row", { name: new RegExp(t("taetigkeit_fahrt")) })).toBeVisible();
  await expect(page.getByRole("button", { name: t("taetigkeit_anlegen") })).toHaveCount(0);
});
