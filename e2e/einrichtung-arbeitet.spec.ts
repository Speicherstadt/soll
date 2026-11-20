import { expect, type Page, test } from "@playwright/test";
import { ALLE_MODULE, betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;
const weiter = (page: Page) => page.getByRole("button", { name: t("einrichtung_weiter") }).click();

const zuDenStandorten = async (page: Page) => {
  await betriebAnlegen(page, ALLE_MODULE, false);
  await page.goto("/einrichtung");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("betrieb_titel"));
  await weiter(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("standorte_titel"));
};

test("a double click on adding a site adds it once", async ({ page }) => {
  await zuDenStandorten(page);
  await page.getByLabel(t("standort_name"), { exact: true }).fill("Werkstatt");
  await page.getByRole("button", { name: t("standort_hinzufuegen") }).dblclick();
  await page.waitForLoadState("networkidle");
  const antwort = await page.request.get("/api/v1/standorte");
  expect((await antwort.json()).standorte).toHaveLength(1);
});

test("a double click on taking a template creates one model", async ({ page }) => {
  await zuDenStandorten(page);
  await page.getByLabel(t("standort_name"), { exact: true }).fill("Werkstatt");
  await page.getByRole("button", { name: t("standort_hinzufuegen") }).click();
  await expect(page.getByRole("list", { name: t("standorte_liste") })).toContainText("Werkstatt");
  await weiter(page);
  await page.getByRole("form", { name: "Vollzeit" }).getByRole("button").dblclick();
  await page.waitForLoadState("networkidle");
  const antwort = await page.request.get("/api/v1/arbeitszeit/modelle");
  expect((await antwort.json()).modelle).toHaveLength(1);
});

/** From the first step to the invitations, with one site, one model and one person */
const zuDenEinladungen = async (page: Page) => {
  await zuDenStandorten(page);
  await page.getByLabel(t("standort_name"), { exact: true }).fill("Werkstatt");
  await page.getByRole("button", { name: t("standort_hinzufuegen") }).click();
  await expect(page.getByRole("list", { name: t("standorte_liste") })).toContainText("Werkstatt");
  await weiter(page);
  await page.getByRole("form", { name: "Vollzeit" }).getByRole("button").click();
  await expect(page.getByRole("list", { name: t("modelle_liste") })).toBeVisible();
  await weiter(page);
  await page.getByLabel(t("csv_text")).fill("Name\nSandra Kühn");
  await page.getByRole("button", { name: t("csv_uebernehmen") }).click();
  await expect(page.getByRole("list", { name: t("mitarbeiter_liste") })).toContainText("Sandra");
};

/** Reloads the page, declining when the browser asks first; returns whether it asked */
const neuLadenAbgelehnt = async (page: Page) => {
  let gefragt = false;
  page.on("dialog", async (dialog) => {
    gefragt ||= dialog.type() === "beforeunload";
    await dialog.dismiss();
  });
  await page.reload({ timeout: 3000 }).catch(() => {});
  return gefragt;
};

test("reloading asks first while people are on the list, so the list is not lost", async ({
  page,
}) => {
  await zuDenEinladungen(page);
  expect(await neuLadenAbgelehnt(page)).toBe(true);
  await expect(page.getByRole("list", { name: t("mitarbeiter_liste") })).toContainText("Sandra");
});

test("reloading asks first while the links are shown, which are shown once only", async ({
  page,
}) => {
  await zuDenEinladungen(page);
  await weiter(page);
  await page.getByRole("button", { name: t("einladungen_erstellen") }).click();
  const links = page.getByRole("list", { name: t("einladungen_liste") }).getByRole("textbox");
  await expect(links).toHaveCount(1);
  expect(await neuLadenAbgelehnt(page)).toBe(true);
  await expect(links).toHaveCount(1);
});
