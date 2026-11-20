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

test("after finishing with links shown, a reload of the start page does not ask", async ({
  page,
}) => {
  await zuDenEinladungen(page);
  await weiter(page);
  await page.getByRole("button", { name: t("einladungen_erstellen") }).click();
  await expect(
    page.getByRole("list", { name: t("einladungen_liste") }).getByRole("textbox"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: t("einrichtung_abschliessen") }).click();
  await expect(page).toHaveURL("/");
  expect(await neuLadenAbgelehnt(page)).toBe(false);
});

/**
 * Holds back the answer to the step's first GET of `pfad`, read before anything was added, until
 * `freigeben` is called: a slow first load answering after a quick add
 */
const ersteListeVerzoegern = async (page: Page, pfad: string) => {
  let freigeben = () => {};
  const frei = new Promise<void>((resolve) => {
    freigeben = resolve;
  });
  let beantwortet: Promise<void> = Promise.resolve();
  await page.route(
    (url) => url.pathname === pfad,
    async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await page.unroute((url) => url.pathname === pfad);
      const antwort = await route.fetch();
      beantwortet = frei.then(() => route.fulfill({ response: antwort }));
    },
  );
  return async () => {
    freigeben();
    await beantwortet;
  };
};

test("a site added while the first load is slow stays on the list", async ({ page }) => {
  await betriebAnlegen(page, ALLE_MODULE, false);
  await page.goto("/einrichtung");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("betrieb_titel"));
  const freigeben = await ersteListeVerzoegern(page, "/api/v1/standorte");
  await weiter(page);
  await page.getByLabel(t("standort_name"), { exact: true }).fill("Werkstatt");
  await page.getByRole("button", { name: t("standort_hinzufuegen") }).click();
  const liste = page.getByRole("list", { name: t("standorte_liste") });
  await expect(liste).toContainText("Werkstatt");
  await freigeben();
  await page.waitForTimeout(200);
  await expect(liste).toContainText("Werkstatt");
});

test("a model taken while the first load is slow stays on the list", async ({ page }) => {
  await zuDenStandorten(page);
  await page.getByLabel(t("standort_name"), { exact: true }).fill("Werkstatt");
  await page.getByRole("button", { name: t("standort_hinzufuegen") }).click();
  await expect(page.getByRole("list", { name: t("standorte_liste") })).toContainText("Werkstatt");
  const freigeben = await ersteListeVerzoegern(page, "/api/v1/arbeitszeit/modelle");
  await weiter(page);
  await page.getByRole("form", { name: "Vollzeit" }).getByRole("button").click();
  const liste = page.getByRole("list", { name: t("modelle_liste") });
  await expect(liste).toContainText("Vollzeit");
  await freigeben();
  await page.waitForTimeout(200);
  await expect(liste).toContainText("Vollzeit");
});

test("a site deleted while the first load is slow does not come back", async ({ page }) => {
  await betriebAnlegen(page, ALLE_MODULE, false);
  await page.goto("/einrichtung");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("betrieb_titel"));
  // the first GET reaches the server only after the add and answers only after the delete
  let lesen = () => {};
  const gelesen = new Promise<void>((resolve) => {
    lesen = resolve;
  });
  let freigeben = () => {};
  const frei = new Promise<void>((resolve) => {
    freigeben = resolve;
  });
  let beantwortet: Promise<void> = Promise.resolve();
  const pfad = (url: URL) => url.pathname === "/api/v1/standorte";
  let gehalten = false;
  await page.route(pfad, async (route) => {
    if (route.request().method() !== "GET" || gehalten) return route.continue();
    gehalten = true;
    beantwortet = gelesen.then(async () => {
      const antwort = await route.fetch();
      await frei;
      await route.fulfill({ response: antwort });
    });
  });
  await weiter(page);
  await page.getByLabel(t("standort_name"), { exact: true }).fill("Werkstatt");
  await page.getByRole("button", { name: t("standort_hinzufuegen") }).click();
  const liste = page.getByRole("list", { name: t("standorte_liste") });
  await expect(liste).toContainText("Werkstatt");
  lesen();
  await page.waitForTimeout(200);
  await page
    .getByRole("button", { name: t("standort_entfernen").replace("{name}", "Werkstatt") })
    .click();
  await expect(liste).toBeHidden();
  freigeben();
  await beantwortet;
  await page.waitForTimeout(200);
  await expect(liste).toBeHidden();
});
