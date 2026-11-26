import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { SEITEN } from "./seiten.ts";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const de = messagesOf("de");

// The app follows the browser's language; Playwright's default is en-US
test.use({ locale: "de" });
const text = (key: string) => de[key] ?? key;

// A signed-in owner of a business with every module, so every area is there
test.beforeEach(async ({ page }) => {
  await betriebAnlegen(page);
});

test("the sidebar reaches every page and marks the current one", async ({ page }) => {
  await page.goto("/");
  const leiste = page.getByRole("navigation", { name: text("nav_bereiche") });
  await expect(leiste.getByText(`v${version}`)).toBeVisible();
  for (const seite of SEITEN.filter((s) => s.pfad !== "/mehr")) {
    await leiste.getByRole("link", { name: text(seite.titel) }).click();
    await expect(page).toHaveURL(seite.pfad);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(text(seite.titel));
    await expect(leiste.getByRole("link", { name: text(seite.titel) })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
});

test("the tab bar reaches Heute, Plan, Abwesenheit and Mehr, and Mehr the rest @phone", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "the tab bar is for phones");
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: text("nav_bereiche") });
  const ziele = [
    { name: "nav_plan", titel: "nav_dienstplan" },
    { name: "nav_abwesenheit", titel: "nav_abwesenheiten" },
    { name: "nav_mehr", titel: "nav_mehr" },
    { name: "nav_heute", titel: "nav_heute" },
  ];
  for (const ziel of ziele) {
    await tabs.getByRole("link", { name: text(ziel.name) }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(text(ziel.titel));
    await expect(tabs.getByRole("link", { name: text(ziel.name) })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
  await page.goto("/mehr");
  for (const key of ["nav_zeiten", "nav_projekte", "nav_auswertungen", "nav_einstellungen"]) {
    await page
      .getByRole("main")
      .getByRole("link", { name: text(key) })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(text(key));
    await page.goBack();
  }
});

test("the tab targets are at least 44 px high @phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the tab bar is for phones");
  await page.goto("/");
  for (const link of await page.getByRole("navigation").getByRole("link").all()) {
    expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("dark stays dark after a reload", async ({ page }) => {
  await page.goto("/einstellungen");
  const gruppe = page.getByRole("main").getByRole("group", { name: text("theme_label") });
  await gruppe.getByRole("button", { name: text("theme_dunkel") }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await gruppe.getByRole("button", { name: text("theme_system") }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

test("both colour pickers show the theme chosen in either", async ({ page }) => {
  await page.goto("/einstellungen");
  await page
    .getByRole("main")
    .getByRole("group", { name: text("theme_label") })
    .getByRole("button", { name: text("theme_dunkel") })
    .click();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("group", { name: text("theme_label") })
      .getByRole("button", { name: text("theme_dunkel") }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("a picker reached by keyboard shows its focus @phone", async ({ page }) => {
  await page.goto("/mehr");
  const knopf = page
    .getByRole("main")
    .getByRole("group", { name: text("theme_label") })
    .getByRole("button", { name: text("theme_system") });
  await knopf.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(knopf).toBeFocused();
  await expect(knopf).not.toHaveCSS("outline-style", "none");
});

test("the chosen language stays after a reload", async ({ page }) => {
  await page.goto("/einstellungen");
  await page.getByRole("main").getByLabel(text("sprache_label")).selectOption("en");
  // choosing a language reloads the page (Paraglide's setLocale), and the settings load their
  // data again: on a busy CI runner the heading takes longer than the default 5 s to return
  const nachNeuladen = { timeout: 15_000 };
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    messagesOf("en").nav_einstellungen ?? "",
    nachNeuladen,
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    messagesOf("en").nav_einstellungen ?? "",
    nachNeuladen,
  );
});

test.describe("in Arabic", () => {
  test.use({ locale: "ar" });

  test("the layout mirrors: the sidebar sits on the right", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const leiste = await page.getByRole("navigation").boundingBox();
    const breite = page.viewportSize()?.width ?? 0;
    expect((leiste?.x ?? 0) + (leiste?.width ?? 0)).toBeGreaterThan(breite - 2);
  });
});

test("the chosen language stays when the browser blocks local storage", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.goto("/einstellungen");
  await page.getByRole("main").getByLabel(text("sprache_label")).selectOption("en");
  // the same reload after setLocale as above: on a busy runner it takes longer than 5 s
  const nachNeuladen = { timeout: 15_000 };
  await expect(page.locator("html")).toHaveAttribute("lang", "en", nachNeuladen);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    messagesOf("en").nav_einstellungen ?? "",
    nachNeuladen,
  );
});

test("projekte and verfahrensdoku do not overflow horizontally on phone @phone", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "the overflow check is for phones");
  for (const route of ["/", "/projekte", "/verfahrensdoku", "/einstellungen"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, `${route} overflowed`).toBe(false);
  }
  const tablist = page.getByRole("tablist");
  await page.goto("/projekte");
  for (const tab of await tablist.getByRole("tab").all()) {
    await expect(tab).toBeVisible();
    const box = await tab.boundingBox();
    const breite = page.viewportSize()?.width ?? 0;
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(breite);
  }
});
