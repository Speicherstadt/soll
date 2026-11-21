import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, senden } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema } from "./thema.ts";

test.use({ locale: "de", timezoneId: "Europe/Berlin" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

const PZ = "/api/v1/projektzeit";

/** Yesterday in Berlin as YYYY-MM-DD: a day whose hours all lie in the past */
const gestern = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(
    Date.now() - 24 * 60 * 60 * 1000,
  );

/** Weber Haustechnik with the order "Bad Elbhof" (40 hours) and the activity Montage */
const werkstatt = async (page: Page) => {
  await betriebAnlegen(page);
  const kunde = await senden(page, "POST", `${PZ}/kunden`, { name: "Elbhof" });
  await senden(page, "POST", `${PZ}/projekte`, {
    kundeId: kunde.kundeId,
    name: "Bad Elbhof",
    budgetMinuten: 2_400,
  });
  await senden(page, "POST", `${PZ}/taetigkeiten`, { name: "Montage" });
};

const stoppuhr = (page: Page) => page.getByRole("region", { name: t("stoppuhr_titel") });
const montage = `Bad Elbhof · Montage`;
const fahrt = `${t("stoppuhr_ohne_auftrag")} · ${t("taetigkeit_fahrt")}`;

test("books by hand, sees the hint, starts, switches in one tap and stops @phone", async ({
  page,
}) => {
  await werkstatt(page);
  await page.goto("/");
  const bereich = stoppuhr(page);
  await expect(bereich.getByText(t("stoppuhr_steht"))).toBeVisible();

  // a booking by hand on yesterday, which has no stamp: more project time than working time
  await bereich.getByLabel(t("stoppuhr_tag"), { exact: true }).fill(gestern());
  await expect(bereich.getByText(t("stoppuhr_leer"))).toBeVisible();
  await bereich.getByRole("button", { name: t("buchung_nachtragen") }).click();
  const dialog = page.getByRole("dialog", { name: t("buchung_titel_nachtragen") });
  await dialog.getByLabel(t("buchung_beginn")).fill("08:00");
  await dialog.getByLabel(t("buchung_ende")).fill("09:00");
  await dialog.getByLabel(t("stoppuhr_auftrag")).selectOption({ label: "Bad Elbhof" });
  await dialog.getByLabel(t("stoppuhr_taetigkeit")).selectOption({ label: "Montage" });
  await dialog.getByLabel(t("stoppuhr_notiz")).fill("Vorwand");
  await dialog.getByRole("button", { name: t("buchung_speichern") }).click();
  await expect(dialog).toBeHidden();
  const zeile = bereich.getByRole("row", { name: /Bad Elbhof/ });
  await expect(zeile).toContainText("08:00–09:00");
  await expect(zeile).toContainText("1:00");
  await expect(zeile).toContainText("Vorwand");
  await expect(bereich.getByRole("status")).toContainText(t("stoppuhr_hinweis_titel"));
  await expect(bereich.getByRole("status")).toContainText(
    t("stoppuhr_hinweis_text", { gebucht: "1:00", gestempelt: "0:00", ueber: "1:00" }),
  );

  // changed until it is billed
  await zeile.getByRole("button", { name: t("buchung_aendern", { name: montage }) }).click();
  const aendern = page.getByRole("dialog", { name: t("buchung_titel_aendern") });
  await aendern.getByLabel(t("buchung_ende")).fill("10:00");
  await aendern.getByRole("button", { name: t("buchung_speichern") }).click();
  await expect(zeile).toContainText("2:00");

  // the switch in one tap: what was booked last, then anything else, then back
  await bereich.getByRole("button", { name: t("stoppuhr_wechseln_zu", { name: montage }) }).click();
  await expect(bereich.getByTestId("stoppuhr-laufend")).toBeVisible();
  await expect(bereich.getByText(montage, { exact: true }).first()).toBeVisible();
  const neu = bereich.getByRole("form", { name: t("stoppuhr_neu") });
  await neu.getByLabel(t("stoppuhr_auftrag")).selectOption({ label: t("stoppuhr_ohne_auftrag") });
  await neu.getByLabel(t("stoppuhr_taetigkeit")).selectOption({ label: t("taetigkeit_fahrt") });
  await neu.getByRole("button", { name: t("stoppuhr_wechseln") }).click();
  const zuFahrt = bereich.getByRole("button", { name: t("stoppuhr_wechseln_zu", { name: fahrt }) });
  await expect(zuFahrt).toHaveAttribute("aria-pressed", "true");
  const zuMontage = bereich.getByRole("button", {
    name: t("stoppuhr_wechseln_zu", { name: montage }),
  });
  await expect(zuMontage).toHaveAttribute("aria-pressed", "false");
  await zuMontage.click();
  await expect(zuMontage).toHaveAttribute("aria-pressed", "true");

  await bereich.getByRole("button", { name: t("stoppuhr_stoppen") }).click();
  await expect(bereich.getByText(t("stoppuhr_steht"))).toBeVisible();

  for (const theme of ["light", "dark"] as const) {
    await thema(page, theme);
    expect((await new AxeBuilder({ page }).analyze()).violations, theme).toEqual([]);
  }

  // the booking feeds the order's budget
  await page.goto("/projekte");
  await expect(page.getByRole("row", { name: /Bad Elbhof/ })).toContainText(
    t("budget_verbraucht", { verbraucht: "2:00", budget: "40:00" }),
  );
});

test("Heute shows only the stopwatch without working time @phone", async ({ page }) => {
  await betriebAnlegen(page, {
    beschaeftigte: false,
    schichten: false,
    kunden: true,
    stempelort: false,
  });
  await page.goto("/");
  await expect(stoppuhr(page)).toBeVisible();
  await expect(page.getByRole("button", { name: t("stempeln_kommen") })).toHaveCount(0);
});
