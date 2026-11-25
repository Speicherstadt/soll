import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, senden, zweiterBrowser } from "./betrieb.ts";
import { heute, t } from "./plan.ts";
import { thema } from "./thema.ts";

/*
 * Rufbereitschaft and the Soll from the plan (S-505): the owner plans Tom's on-call duty for today
 * and publishes it, Tom sees it, begins and ends a call-out and adds one afterwards, and the month
 * counts it; with "Soll aus dem Plan" the month shows the planned Soll beside the Ist.
 */

test.use({ locale: "de" });

/** Weber Haustechnik with its site and Tom, who has joined */
const mitTom = async (jonas: Page, browser: Browser) => {
  await betriebAnlegen(jonas);
  await senden(jonas, "POST", "/api/v1/standorte", { name: "Werkstatt", land: "HH" });
  const tom = await zweiterBrowser(browser, test.info());
  const tomId = await einladungAnnehmen(jonas, tom, "Tom Berger");
  return { tom, tomId };
};

/** The owner plans Tom's duty for today, 0:00 to 23:59, in the dialog of the plan, and publishes */
const rufPlanen = async (jonas: Page) => {
  await jonas.goto(`/dienstplan?tag=${heute()}`);
  await jonas.getByRole("button", { name: t("oncall_add") }).click();
  const dialog = jonas.getByRole("dialog", { name: t("oncall_add") });
  await dialog.getByLabel(t("plan_tag")).fill(heute());
  await dialog.getByLabel(t("plan_person")).selectOption({ label: "Tom Berger" });
  await dialog.getByLabel(t("plan_beginn")).fill("00:00");
  await dialog.getByLabel(t("plan_ende")).fill("23:59");
  await dialog.getByLabel(t("oncall_response")).fill("45");
  await dialog.getByRole("button", { name: t("plan_speichern") }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    jonas.getByText(t("oncall_title"), { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await jonas.getByRole("button", { name: t("plan_veroeffentlichen") }).click();
  await expect(jonas.getByText(/ · Entwurf$/)).toHaveCount(0);
};

const karte = (page: Page) => page.getByRole("region", { name: t("oncall_title") });

/** Tom begins and ends a call-out on Heute and adds one afterwards */
const einsaetze = async (tom: Page) => {
  await tom.goto("/");
  await expect(karte(tom)).toContainText("Du hast Rufbereitschaft bis 23:59.");
  await karte(tom)
    .getByRole("button", { name: t("callout_start") })
    .click();
  await expect(karte(tom).getByRole("status")).toContainText("Einsatz läuft seit");
  await karte(tom)
    .getByRole("button", { name: t("callout_stop") })
    .click();
  await expect(karte(tom).getByRole("button", { name: t("callout_start") })).toBeVisible();
  await karte(tom)
    .getByRole("button", { name: t("callout_add") })
    .click();
  const dialog = tom.getByRole("dialog", { name: t("callout_add") });
  await dialog.getByLabel(t("callout_from")).fill("00:01");
  await dialog.getByLabel(t("callout_until")).fill("00:02");
  await dialog.getByLabel(t("callout_reason")).fill("Heizung bei Kunde");
  await dialog.getByRole("button", { name: t("callout_save") }).click();
  await expect(dialog).toHaveCount(0);
};

/** The month shows the call-outs as working time of the day */
const imMonat = async (tom: Page) => {
  await tom.goto("/monat");
  await tom.getByRole("button", { name: t("monat_folgemonat") }).click();
  const tabelle = tom.getByRole("table", { name: t("monat_tage") });
  await expect(tabelle).toContainText(/Einsatz 00:01–00:02 \(0:01\)/);
  await expect(tabelle).toContainText(/Einsatz \d\d:\d\d–\d\d:\d\d \(0:0\d\)/);
};

const ablauf = async (jonas: Page, browser: Browser) => {
  const { tom } = await mitTom(jonas, browser);
  await rufPlanen(jonas);
  await tom.goto(`/dienstplan?tag=${heute()}`);
  await expect(
    tom.getByText(t("oncall_title"), { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await einsaetze(tom);
  await imMonat(tom);
  return { tom };
};

test("plans Rufbereitschaft, Tom begins, ends and adds call-outs, the month counts them", async ({
  page,
  browser,
}) => {
  test.skip(new Date().getHours() === 0, "the call-out added afterwards lies at 0:01");
  await ablauf(page, browser);
});

test("Rufbereitschaft and call-outs on a phone @phone", async ({ page, browser }) => {
  test.skip(new Date().getHours() === 0, "the call-out added afterwards lies at 0:01");
  await ablauf(page, browser);
});

test("a call-out outside a published duty is refused with a reason", async ({ page, browser }) => {
  const { tom } = await mitTom(page, browser);
  await tom.goto("/");
  await expect(karte(tom)).toHaveCount(0);
  const minute = Math.floor(Date.now() / 60_000) * 60_000;
  const antwort = await tom.request.post("/api/v1/arbeitszeit/einsaetze", {
    data: { beginn: minute - 7_200_000, ende: minute - 3_600_000, grund: "Notruf" },
  });
  expect(antwort.status()).toBe(409);
  expect(await antwort.json()).toEqual({ fehler: "keine_rufbereitschaft" });
});

test("Soll aus dem Plan: the month shows the planned Soll beside the Ist", async ({ page }) => {
  await betriebAnlegen(page);
  await senden(page, "POST", "/api/v1/standorte", { name: "Werkstatt", land: "HH" });
  const { nutzerId } = (await (await page.request.get("/api/v1/betrieb")).json()) as {
    nutzerId: string;
  };
  const { standorte } = (await (await page.request.get("/api/v1/standorte")).json()) as {
    standorte: { standortId: string }[];
  };
  await page.goto("/einstellungen");
  const bereich = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: t("target_source_title") }) });
  await bereich.getByRole("button", { name: t("plan_speichern") }).click();
  await expect(bereich.getByRole("status")).toContainText("Veröffentlichter Plan");
  await senden(page, "POST", "/api/v1/dienstplan/schichten", {
    standortId: standorte[0]?.standortId ?? "",
    nutzerId,
    tag: heute(),
    beginnMinute: 0,
    endeMinute: 6 * 60,
    pauseMinuten: 0,
    rolle: "Bereitschaft",
  });
  await senden(page, "POST", "/api/v1/dienstplan/veroeffentlichen", {
    standortId: standorte[0]?.standortId ?? "",
    tag: heute(),
  });
  await page.goto("/monat");
  await page.getByRole("button", { name: t("monat_folgemonat") }).click();
  const tabelle = page.getByRole("table", { name: t("monat_tage") });
  await expect(tabelle.getByRole("columnheader", { name: t("month_column_target") })).toBeVisible();
  await expect(tabelle.getByRole("row").filter({ hasText: "6:00" })).toHaveCount(1);
  await expect(page.getByRole("region", { name: t("monat_summen") })).toContainText("6:00");
});

for (const farben of ["light", "dark"] as const) {
  test(`axe finds nothing on the plan with Rufbereitschaft, Heute and the settings in ${farben} @phone`, async ({
    page,
    browser,
  }) => {
    const { tom } = await mitTom(page, browser);
    await rufPlanen(page);
    await thema(page, farben);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: t("oncall_add") }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await tom.goto("/");
    await thema(tom, farben);
    await expect(karte(tom)).toBeVisible();
    expect((await new AxeBuilder({ page: tom }).analyze()).violations).toEqual([]);
    await karte(tom)
      .getByRole("button", { name: t("callout_add") })
      .click();
    expect((await new AxeBuilder({ page: tom }).analyze()).violations).toEqual([]);
    await page.goto("/einstellungen");
    await thema(page, farben);
    await expect(page.getByRole("heading", { name: t("target_source_title") })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
