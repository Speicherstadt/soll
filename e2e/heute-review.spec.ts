import { expect, test } from "@playwright/test";
import { betriebAnlegen, senden } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

// tdd-review findings for PR #102 (feat/heute-redesign)

test.describe("in pl", () => {
  test.use({ locale: "pl", timezoneId: "Europe/Berlin" });
  const pl = messagesOf("pl");
  const t = (key: string) => pl[key] ?? key;

  // Finding 1: LaufenderTag's aktionen row uses `sm:flex-row` without `sm:flex-wrap`. At 1024px
  // (`lg:grid-cols-2` with sidebar), the card is ~348px wide and the two Polish buttons
  // ("Rozpocznij przerwę" + "Wyjście") overflow past the right border of the card.
  test("Heute stamp buttons stay inside the running-day card at 1024px in Polish", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await betriebAnlegen(page);
    await page.goto("/");

    await page.getByRole("button", { name: t("stempeln_kommen"), exact: true }).click();
    const laufend = page.getByRole("region", { name: t("tag_laufend") });
    const gehenBtn = page.getByRole("button", { name: t("stempeln_gehen"), exact: true });
    await expect(gehenBtn).toBeVisible();

    const cardBox = await laufend.boundingBox();
    const gehenBox = await gehenBtn.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(gehenBox).not.toBeNull();
    if (cardBox && gehenBox) {
      expect(gehenBox.x + gehenBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
    }
  });
});

test.describe("touch targets and Solid 2.0 slot evaluation", () => {
  test.use({ locale: "de", timezoneId: "Europe/Berlin" });
  const de = messagesOf("de");
  const t = (key: string, werte: Record<string, string> = {}) =>
    Object.entries(werte).reduce(
      (text, [name, wert]) => text.replace(`{${name}}`, wert),
      de[key] ?? key,
    );

  // Finding 2: DESIGN.md ("Handy (unter md): Berührungsziele mindestens 44 px") requires >= 44px
  // touch targets on phones. PR #102 shrank the Stoppuhr `Wechsel` one-tap buttons from `min-h-11`
  // (44px) to `min-h-10` (40px).
  test("Stoppuhr one-tap switch buttons keep at least 44px touch target height @phone", async ({
    page,
  }) => {
    await betriebAnlegen(page);
    const kunde = await senden(page, "POST", "/api/v1/projektzeit/kunden", { name: "Elbhof" });
    await senden(page, "POST", "/api/v1/projektzeit/projekte", {
      kundeId: kunde.kundeId,
      name: "Bad Elbhof",
      budgetMinuten: 2_400,
    });
    await senden(page, "POST", "/api/v1/projektzeit/taetigkeiten", { name: "Montage" });

    await page.goto("/");
    const stoppuhr = page.getByRole("region", { name: t("stoppuhr_titel") });
    const neu = stoppuhr.getByRole("form", { name: t("stoppuhr_neu") });
    await neu.getByLabel(t("stoppuhr_auftrag")).selectOption({ label: "Bad Elbhof" });
    await neu.getByLabel(t("stoppuhr_taetigkeit")).selectOption({ label: "Montage" });
    await neu.getByRole("button", { name: t("stoppuhr_starten") }).click();

    const wechselnBtn = stoppuhr.getByRole("button", {
      name: t("stoppuhr_wechseln_zu", { name: "Bad Elbhof · Montage" }),
    });
    await expect(wechselnBtn).toBeVisible();
    const box = await wechselnBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  // Finding 3: LaufenderTag reads `props.aktionen` twice (`<Show when={props.aktionen}>` and
  // `{props.aktionen}`), evaluating the JSX prop getter twice and instantiating the action subtree
  // twice in Solid 2.0 instead of resolving it once (e.g. `children()` or `<Show>` function child).
  test("LaufenderTag evaluates its aktionen JSX prop only once", async ({ page }) => {
    await page.goto("/anmelden");
    const reads = await page.evaluate(async () => {
      // Vite dev server compiles Solid 2.0 JSX at /src/zeiten/laufenderTag.tsx
      const url = "/src/zeiten/laufenderTag.tsx";
      const { LaufenderTag } = (await import(/* @vite-ignore */ url)) as {
        LaufenderTag: (props: Record<string, unknown>) => unknown;
      };
      let count = 0;
      const stand = {
        zustand: "aus" as const,
        seit: null,
        istMinuten: 0,
        pausenMinuten: 0,
        pausenabzugMinuten: 0,
        befunde: [],
        ausblick: null,
        nichtHinterlegt: false,
      };
      LaufenderTag({
        stand,
        sollMinuten: 480,
        get aktionen() {
          count += 1;
          const btn = document.createElement("button");
          btn.textContent = "Kommen";
          return btn;
        },
      });
      return count;
    });
    expect(reads).toBe(1);
  });
});
