import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, zweiterBrowser } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

// A business without employees (BAULISTE.md S-603): project time only, until the first employed
// person joins; then working time is on and the owner reads why
test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

const FREELANCER = { beschaeftigte: false, schichten: false, kunden: true, stempelort: false };

/** The names of the links of the navigation: the sidebar at the desktop, the tab bar on a phone */
const navigation = (page: Page) =>
  page.getByRole("navigation", { name: t("nav_bereiche") }).getByRole("link");

test("a business without employees shows project time only, also at its addresses @phone", async ({
  page,
  isMobile,
}) => {
  await betriebAnlegen(page, FREELANCER);
  await page.goto("/");
  await expect(page.getByRole("main")).toContainText(t("heute_ohne_arbeitszeit"));
  await expect(navigation(page)).toHaveText(
    isMobile
      ? [t("nav_heute"), t("nav_projekte"), t("nav_mehr")]
      : [t("nav_heute"), t("nav_projekte"), t("nav_auswertungen"), t("nav_einstellungen")],
  );
  for (const pfad of ["/zeiten", "/monat", "/abwesenheiten", "/dienstplan"]) {
    await page.goto(pfad);
    await expect(page, pfad).toHaveURL(/localhost:5178\/$/);
  }
  await page.goto("/projekte");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("nav_projekte"));
});

test("the first employee switches working time on and the owner reads why @phone", async ({
  page,
  browser,
}, info) => {
  await betriebAnlegen(page, FREELANCER);
  await page.goto("/");
  const hinweis = page.getByRole("region", { name: t("pflicht_hinweis_titel") });
  await expect(page.getByRole("main")).toContainText(t("heute_ohne_arbeitszeit"));
  await expect(hinweis).toHaveCount(0);

  const ole = await zweiterBrowser(browser, info);
  await einladungAnnehmen(page, ole, "Ole Jensen");
  await ole.close();

  await page.reload();
  await expect(hinweis).toBeVisible();
  await expect(hinweis).toContainText("1 ABR 22/21");
  await expect(hinweis).toContainText("§ 3 Abs. 2 Nr. 1 ArbSchG");
  // working time is on: Heute offers the stamp button, its addresses open
  await expect(page.getByRole("main")).not.toContainText(t("heute_ohne_arbeitszeit"));
  await page.goto("/zeiten");
  await expect(page).toHaveURL(/\/zeiten$/);
  await expect(hinweis).toBeVisible();

  await hinweis.getByRole("button", { name: t("pflicht_hinweis_ok") }).click();
  await expect(hinweis).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("nav_zeiten"));
  await expect(hinweis).toHaveCount(0);

  // and it cannot be switched off while Ole works here
  await page.goto("/einstellungen");
  const arbeitszeit = page.getByRole("checkbox", { name: t("modul_arbeitszeit") });
  await expect(arbeitszeit).toBeChecked();
  await arbeitszeit.uncheck();
  await expect(page.getByRole("alert")).toHaveText(t("fehler_arbeitszeit_pflicht"));
  await expect(arbeitszeit).toBeChecked();
});
