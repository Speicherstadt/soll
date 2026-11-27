import { expect, test } from "@playwright/test";
import { betriebAnlegen, senden } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de", viewport: { width: 1440, height: 1000 } });
const de = messagesOf("de");
const ar = messagesOf("ar");
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

// tdd-review finding: packages/ui/src/styles.css:101-108 defines `padding-inline-end: 2.25rem`
// inside `@layer base`, which is overridden by `px-2` (`@layer utilities`) in `feld`
// (apps/web/src/einrichtung/stil.ts:3), leaving only 8px padding so option text collides with
// the custom chevron background SVG at `right: 0.75rem`.
test("native select with feld class preserves padding-inline-end for the custom chevron", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/abwesenheiten");
  const select = page
    .getByRole("region", { name: t("abw_antrag_titel") })
    .locator("select")
    .first();
  await expect(select).toBeVisible();
  const paddingEnd = await select.evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).paddingInlineEnd),
  );
  expect(paddingEnd).toBeGreaterThanOrEqual(32);
});

// tdd-review finding: apps/web/src/monat/tabelle.tsx:118-123 uses `<Th class="text-end">` (inherits
// `dir="rtl"` -> aligns left in Arabic) while lines 137-169 use `<Td class="text-end" dir="ltr">`
// (forces `dir="ltr"` -> aligns right in Arabic), aligning column headers and values to opposite edges.
test("monat table numeric headers and cells align to the same visual side in RTL", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "ar",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await betriebAnlegen(page);
  await senden(page, "POST", "/api/v1/arbeitszeit/stempelungen", { art: "kommen" });
  await page.goto("/monat");
  await page.getByRole("button", { name: ar.monat_naechster ?? "الشهر التالي" }).click();
  const table = page.locator("main table");
  await expect(table).toBeVisible();
  const alignment = await table.evaluate((tbl) => {
    const th = tbl.querySelectorAll("thead th")[1];
    const td = tbl.querySelectorAll("tbody tr:first-child td")[0];
    if (!th || !td) return null;
    const visualSide = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.textAlign === "end") return style.direction === "rtl" ? "left" : "right";
      if (style.textAlign === "start") return style.direction === "rtl" ? "right" : "left";
      return style.textAlign;
    };
    return {
      htmlDir: document.documentElement.dir,
      thSide: visualSide(th),
      tdSide: visualSide(td),
    };
  });
  expect(alignment).not.toBeNull();
  expect(alignment?.htmlDir).toBe("rtl");
  expect(alignment?.tdSide).toBe(alignment?.thSide);
  await context.close();
});

// tdd-review finding: apps/web/src/routes/auswertungen.tsx:25 reads `datev.data?.ok` outside
// `<Loading>`, suspending the entire Auswertungen route (including AuslastungBereich) while
// `/api/v1/arbeitszeit/datev` is pending.
test("Auslastung renders immediately on /auswertungen while DATEV query is still pending", async ({
  page,
}) => {
  await betriebAnlegen(page);
  let releaseDatev: (() => void) | undefined;
  const datevHeld = new Promise<void>((resolve) => {
    releaseDatev = resolve;
  });
  await page.route("**/api/v1/arbeitszeit/datev", async (route) => {
    await datevHeld;
    await route.continue();
  });
  await page.goto("/auswertungen");
  await expect(page.getByRole("heading", { name: t("auslastung_titel") })).toBeVisible({
    timeout: 3000,
  });
  releaseDatev?.();
});
