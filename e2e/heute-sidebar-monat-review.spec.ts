import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

// tdd-review findings for PR #125 (feat/heute-sidebar-monat-ux)

test.use({ locale: "de", timezoneId: "Europe/Berlin" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

// Finding 1 (WCAG 2.5.3 Label in Name): KontoFuss sets aria-label="Konto" on the Menu button
// whose visible label is the user's name ("Jonas Weber"), hiding the user's name from assistive
// tech and breaking label-in-name.
test("sidebar account menu button exposes the signed-in person's name as accessible name", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: t("nav_bereiche") });
  await expect(nav.getByRole("button", { name: /Jonas Weber/ })).toBeVisible();
});

// Finding 2: Clicking "Konto" in the sidebar account menu navigates to /einstellungen but leaves
// the default "Betrieb" tab selected instead of opening the "Konto" tab (and does nothing when
// already on /einstellungen on another tab).
test("sidebar Konto menu entry opens the Konto tab on /einstellungen even from another tab", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: t("nav_bereiche") });
  const trigger = nav.locator("button[aria-haspopup='menu']");
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByRole("menuitem", { name: t("einstellungen_tab_konto") }).click();
  await expect(page).toHaveURL(/\/einstellungen/);
  await expect(page.getByRole("tab", { name: t("einstellungen_tab_konto") })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Switch to Betrieb tab, then click Konto in the sidebar menu again
  await page.getByRole("tab", { name: t("einstellungen_tab_betrieb") }).click();
  await expect(page.getByRole("tab", { name: t("einstellungen_tab_betrieb") })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await trigger.click();
  await page.getByRole("menuitem", { name: t("einstellungen_tab_konto") }).click();
  await expect(page.getByRole("tab", { name: t("einstellungen_tab_konto") })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

// Finding 3: When nutzerName is empty or absent in an older offline cache, KontoFuss hides the
// entire account menu so "Abmelden" is unreachable in the sidebar.
test("sidebar account menu remains accessible when nutzerName is missing in session data", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.route("**/api/v1/betrieb", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    delete body.nutzerName;
    await route.fulfill({ response, json: body });
  });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: t("nav_bereiche") });
  const trigger = nav.locator("button[aria-haspopup='menu']");
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("menuitem", { name: t("abmelden") })).toBeVisible();
});

// Finding 4 (DESIGN.md: Handy unter md -> Berührungsziele mindestens 44 px): Stoppuhr Starten
// button uses sm:h-9 sm:min-h-9, shrinking below 44px at viewports between 640px and 767px.
test("Stoppuhr Starten button keeps at least 44px height below md (680px viewport)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 680, height: 800 });
  await betriebAnlegen(page);
  await page.goto("/");
  const stoppuhr = page.getByRole("region", { name: t("stoppuhr_titel") });
  const starten = stoppuhr
    .getByRole("form", { name: t("stoppuhr_neu") })
    .getByRole("button", { name: t("stoppuhr_starten") });
  await expect(starten).toBeVisible();
  const box = await starten.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.height).toBeGreaterThanOrEqual(44);
});
