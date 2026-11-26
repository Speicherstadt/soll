import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

// tdd-review findings for feat/abwesenheiten-redesign

const mitVerlauf = async (page: Page) => {
  await page.route("**/api/v1/arbeitszeit/konten*", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    const ueber = body.ueberstunden as Record<string, unknown> | undefined;
    if (ueber && ueber.ok === true) {
      ueber.verlauf = [
        { monat: "2026-09", saldoMinuten: 60 },
        { monat: "2026-10", saldoMinuten: 150 },
        { monat: "2026-11", saldoMinuten: 215 },
      ];
    }
    await route.fulfill({ response, json: body });
  });
};

test.describe("abwesenheiten-review", () => {
  test.use({ locale: "de", timezoneId: "Europe/Berlin" });
  const de = messagesOf("de");
  const t = (key: string) => de[key] ?? key;

  // Finding 1: UeberstundenChart's `optionen` callback reads reactive `daten()` (`props.verlauf` ->
  // `konten.data`) inside UPlotChart's `createEffect` effect callback, which has no ambient owner
  // in Solid 2.0. Whenever `ueberstunden.verlauf` has >= 2 months, /abwesenheiten crashes with
  // `[PRIMITIVE_IN_EFFECT_CALLBACK]`.
  test("UeberstundenChart renders without Solid 2.0 PRIMITIVE_IN_EFFECT_CALLBACK crash", async ({
    page,
  }) => {
    await betriebAnlegen(page);
    await mitVerlauf(page);

    await page.goto("/abwesenheiten");
    await expect(page.getByText("PRIMITIVE_IN_EFFECT_CALLBACK")).toHaveCount(0);
    await expect(page.getByRole("img", { name: t("konten_verlauf_label") })).toBeVisible();
  });

  // Finding 2: UeberstundenChart renders <h3> directly under Seite's <h1> with no <h2> in between,
  // skipping a heading level and violating axe `heading-order` (compare MonatChart, which uses <h2>).
  test("UeberstundenChart uses h2 and passes axe heading-order in light and dark mode", async ({
    page,
  }) => {
    await betriebAnlegen(page);
    await mitVerlauf(page);

    for (const farbe of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: farbe });
      await page.goto("/abwesenheiten");
      await expect(
        page.getByRole("heading", { level: 2, name: t("konten_verlauf_titel") }),
      ).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, farbe).toEqual([]);
    }
  });
});
