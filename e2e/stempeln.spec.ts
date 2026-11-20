import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { weberMitSandra } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

const knopf = (page: Page, key: string) => page.getByRole("button", { name: t(key), exact: true });
const laufend = (page: Page) => page.getByRole("region", { name: t("tag_laufend") });

test("stamps a day on Heute with the minutes and the next finding @phone", async ({
  page,
  browser,
}) => {
  await weberMitSandra(page, browser, test.info());
  await page.goto("/");
  await expect(laufend(page)).toContainText(t("stempeln_zustand_aus"));
  await expect(laufend(page)).toContainText("8:00");

  await knopf(page, "stempeln_kommen").click();
  await expect(page.getByTestId("zustand")).toHaveText(/^Eingestempelt seit \d\d:\d\d$/);
  await expect(laufend(page).getByRole("definition").nth(1)).toHaveText(/^0:0\d$/);
  // the next finding with its norm: the break owed after six hours (§ 4 ArbZG)
  await expect(page.getByText(/^Pause fällig in [56]:\d\d$/)).toBeVisible();
  await expect(page.getByText(/· § 4 ArbZG$/)).toBeVisible();

  await knopf(page, "stempeln_pause_starten").click();
  await expect(page.getByTestId("zustand")).toHaveText(/^In Pause seit \d\d:\d\d$/);
  await expect(knopf(page, "stempeln_pause_beenden")).toHaveAttribute("aria-pressed", "true");
  await knopf(page, "stempeln_pause_beenden").click();
  await expect(page.getByTestId("zustand")).toHaveText(/^Eingestempelt seit/);
  await knopf(page, "stempeln_gehen").click();
  await expect(page.getByTestId("zustand")).toHaveText(t("stempeln_zustand_aus"));
  await expect(page.getByText(/^Ruhezeit bis /)).toBeVisible();
  await expect(page.getByText("· § 5 Abs. 1 ArbZG", { exact: false })).toBeVisible();
  const liste = page.getByRole("list", { name: t("stempelungen_titel") });
  await expect(liste.getByRole("listitem")).toHaveCount(4);
  // the icon of an icon button keeps its 16 px (the padding of the button size once squeezed it)
  const icon = await liste.getByRole("button").first().locator("svg").boundingBox();
  expect(icon?.width).toBe(16);
  await expect(knopf(page, "stempeln_kommen")).toBeVisible();
});

test("stamps once when the button is pressed again before the day has reloaded", async ({
  page,
  browser,
}) => {
  await weberMitSandra(page, browser, test.info());
  await page.goto("/");
  await expect(knopf(page, "stempeln_kommen")).toBeVisible();
  // a slow network: the day comes back only well after the stamp was taken
  await page.route("**/api/v1/arbeitszeit/tag?**", async (route) => {
    await new Promise((fertig) => setTimeout(fertig, 1_500));
    await route.continue();
  });
  const stempel: string[] = [];
  page.on("request", (anfrage) => {
    if (anfrage.method() === "POST" && anfrage.url().endsWith("/api/v1/arbeitszeit/stempelungen"))
      stempel.push(anfrage.postData() ?? "");
  });
  const angenommen = page.waitForResponse(
    (antwort) =>
      antwort.request().method() === "POST" &&
      antwort.url().endsWith("/api/v1/arbeitszeit/stempelungen"),
  );
  await knopf(page, "stempeln_kommen").click();
  await angenommen;
  // pressed again while the old state still shows: no second Kommen
  await knopf(page, "stempeln_kommen")
    .click({ timeout: 500 })
    .catch(() => undefined);
  await expect(page.getByTestId("zustand")).toHaveText(/^Eingestempelt seit/);
  expect(stempel).toHaveLength(1);
});

test("shows the employee a correction by the owner: who, what, when and why @phone", async ({
  page,
  browser,
}) => {
  const { jonas } = await weberMitSandra(page, browser, test.info());
  await jonas.goto("/zeiten");
  await jonas.getByLabel(t("zeiten_person")).selectOption({ label: "Sandra Kühn" });
  await jonas.getByRole("button", { name: t("zeiten_vortag") }).click();

  const nachtragen = async (art: string, uhrzeit: string, grund: string) => {
    await jonas.getByRole("button", { name: t("nachtragen"), exact: true }).click();
    const dialog = jonas.getByRole("dialog", { name: t("korrektur_titel_nachtragen") });
    await dialog.getByLabel(t("korrektur_art")).selectOption({ label: art });
    await dialog.getByLabel(t("korrektur_uhrzeit")).fill(uhrzeit);
    await dialog.getByLabel(t("korrektur_grund")).fill(grund);
    await dialog.getByRole("button", { name: t("korrektur_speichern") }).click();
    await expect(dialog).toBeHidden();
  };
  await nachtragen("Kommen", "07:00", "Handy war leer");
  await nachtragen("Gehen", "14:30", "Handy war leer");
  // 7:30 without a break: the finding with its norm
  await expect(jonas.getByText(t("befund_pause_fehlt", { minuten: "30" }))).toBeVisible();
  await expect(jonas.getByText("Verstoß · § 4 Satz 1 ArbZG")).toBeVisible();

  await jonas
    .getByRole("button", { name: t("stempel_aendern", { art: "Gehen", uhrzeit: "14:30" }) })
    .click();
  const aendern = jonas.getByRole("dialog", { name: t("korrektur_titel_aendern") });
  await aendern.getByRole("button", { name: t("korrektur_speichern") }).click();
  await expect(aendern.getByRole("alert")).toHaveText(t("korrektur_fehler_grund"));
  await aendern.getByLabel(t("korrektur_uhrzeit")).fill("13:30");
  await aendern.getByLabel(t("korrektur_grund")).fill("Arzttermin, früher gegangen");
  await aendern.getByRole("button", { name: t("korrektur_speichern") }).click();
  await expect(aendern).toBeHidden();

  await page.goto("/zeiten");
  await page.getByRole("button", { name: t("zeiten_vortag") }).click();
  const stempel = page.getByRole("list", { name: t("stempelungen_titel") });
  await expect(stempel).toContainText("13:30");
  await expect(stempel).not.toContainText("14:30");
  const aenderungen = page.getByRole("list", { name: t("aenderungen_titel") });
  await expect(aenderungen).toContainText("Jonas Weber hat Gehen 14:30 auf Gehen 13:30 geändert");
  await expect(aenderungen).toContainText("Grund: Arzttermin, früher gegangen");
  await expect(aenderungen).toContainText("Jonas Weber hat Kommen 07:00 nachgetragen");
});

test("lets a person add a forgotten stamp of their own with a reason @phone", async ({
  page,
  browser,
}) => {
  await weberMitSandra(page, browser, test.info());
  await page.goto("/");
  await knopf(page, "stempeln_kommen").click();
  await expect(page.getByTestId("zustand")).toHaveText(/^Eingestempelt seit/);
  await page.getByRole("button", { name: /Kommen um \d\d:\d\d ändern/ }).click();
  const dialog = page.getByRole("dialog", { name: t("korrektur_titel_aendern") });
  await dialog.getByLabel(t("korrektur_uhrzeit")).fill("00:00");
  await dialog.getByLabel(t("korrektur_grund")).fill("Schon früher angefangen");
  await dialog.getByRole("button", { name: t("korrektur_speichern") }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("zustand")).toHaveText("Eingestempelt seit 00:00");
  await expect(page.getByRole("list", { name: t("aenderungen_titel") })).toContainText(
    "Grund: Schon früher angefangen",
  );
});

for (const theme of ["light", "dark"] as const) {
  test(`axe finds nothing on Heute while working and in a correction in ${theme} @phone`, async ({
    page,
    browser,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await weberMitSandra(page, browser, test.info());
    await page.goto("/");
    await knopf(page, "stempeln_kommen").click();
    await expect(page.getByTestId("zustand")).toHaveText(/^Eingestempelt seit/);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: t("nachtragen"), exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test.describe("in Arabic", () => {
  test.use({ locale: "ar" });
  const ar = messagesOf("ar");

  test("stamps from right to left, with the norm in German @phone", async ({ page, browser }) => {
    await weberMitSandra(page, browser, test.info());
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.getByRole("button", { name: ar.stempeln_kommen ?? "", exact: true }).click();
    await expect(
      page.getByRole("button", { name: ar.stempeln_pause_starten ?? "", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/· § 4 ArbZG$/)).toBeVisible();
  });
});
