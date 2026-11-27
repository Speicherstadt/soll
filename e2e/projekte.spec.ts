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

const tab = (page: Page, key: string) => page.getByRole("tab", { name: t(key) }).click();

test("the owner keeps customers, orders with a budget, activities and rates @phone", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/projekte");
  await expect(page.getByRole("heading", { level: 1, name: t("nav_projekte") })).toBeVisible();

  await tab(page, "projekte_tab_kunden");
  await page.getByRole("button", { name: t("kunde_anlegen") }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(t("kunde_name"), { exact: true }).fill("Elbhof");
  await dialog.getByLabel(t("kunde_nummer"), { exact: true }).fill("K-1001");
  await dialog.getByRole("button", { name: t("kunde_anlegen") }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("cell", { name: "Elbhof", exact: true })).toBeVisible();

  await tab(page, "projekte_tab_auftraege");
  await page.getByRole("button", { name: t("auftrag_anlegen") }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(t("auftrag_kunde"), { exact: true }).selectOption({ label: "Elbhof" });
  await dialog.getByLabel(t("auftrag_name"), { exact: true }).fill("Bad Elbhof");
  await dialog.getByLabel(t("auftrag_budget_stunden"), { exact: true }).fill("40");
  await dialog.getByLabel(t("auftrag_budget_euro"), { exact: true }).fill("4.000");
  await dialog.getByRole("button", { name: t("auftrag_anlegen") }).click();
  await expect(dialog).toBeHidden();
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
  await page.getByRole("button", { name: t("taetigkeit_anlegen") }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(t("taetigkeit_name"), { exact: true }).fill("Montage");
  await dialog.getByRole("button", { name: t("taetigkeit_anlegen") }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("cell", { name: "Montage", exact: true })).toBeVisible();

  await tab(page, "projekte_tab_saetze");
  await expect(page.getByText(t("saetze_leer"))).toBeVisible();
  await page.getByRole("button", { name: t("satz_anlegen") }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(t("satz_taetigkeit"), { exact: true }).selectOption({ label: "Montage" });
  await dialog.getByLabel(t("satz_betrag"), { exact: true }).fill("85,00");
  await dialog.getByRole("button", { name: t("satz_anlegen") }).click();
  await expect(dialog).toBeHidden();
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

// [tdd-review] PR #101: Checkbox spreads `checked` as DOM property, not defaultChecked,
// so form.reset() clears the default checked state on the new-activity form.
test("the new-activity billable checkbox stays checked after creating an activity", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/projekte");
  await tab(page, "projekte_tab_taetigkeiten");
  await page.getByRole("button", { name: t("taetigkeit_anlegen") }).click();
  const dialog = page.getByRole("dialog");
  const abrechenbar = dialog.getByRole("checkbox", { name: t("taetigkeit_abrechenbar") });
  await expect(abrechenbar).toBeChecked();
  await dialog.getByLabel(t("taetigkeit_name"), { exact: true }).fill("Montage");
  await dialog.getByRole("button", { name: t("taetigkeit_anlegen") }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("cell", { name: "Montage", exact: true })).toBeVisible();

  await page.getByRole("button", { name: t("taetigkeit_anlegen") }).click();
  await expect(
    page.getByRole("dialog").getByRole("checkbox", { name: t("taetigkeit_abrechenbar") }),
  ).toBeChecked();
});
