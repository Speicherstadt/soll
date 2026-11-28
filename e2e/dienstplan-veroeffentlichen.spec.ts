import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, senden, zweiterBrowser } from "./betrieb.ts";
import { ab, t } from "./plan.ts";

/*
 * Publishing the plan and the calendar feed (S-503): the owner publishes the week, Tom sees his
 * shift and subscribes to his shifts as a calendar (RFC 5545) under a secret link.
 */

test.use({ locale: "de" });

/** Café Elbblick with its site and Tom; a late shift for Tom on the Monday of next week, a draft */
const elbblickMitEntwurf = async (jonas: Page, browser: Browser) => {
  await betriebAnlegen(jonas);
  await senden(jonas, "POST", "/api/v1/standorte", { name: "Elbe", land: "HH" });
  const tom = await zweiterBrowser(browser, test.info());
  const tomId = await einladungAnnehmen(jonas, tom, "Tom Berger");
  const { standorte } = (await (await jonas.request.get("/api/v1/standorte")).json()) as {
    standorte: { standortId: string }[];
  };
  await senden(jonas, "POST", "/api/v1/dienstplan/schichten", {
    standortId: standorte[0]?.standortId ?? "",
    tag: ab(0),
    beginnMinute: 14 * 60,
    endeMinute: 22 * 60,
    pauseMinuten: 30,
    rolle: "Service",
    nutzerId: tomId,
  });
  return { tom };
};

const veroeffentlichenKnopf = (page: Page) =>
  page.getByRole("button", { name: t("plan_veroeffentlichen") });

/** The owner publishes the week of next Monday from the head of the plan */
const veroeffentlichen = async (jonas: Page) => {
  await jonas.goto(`/dienstplan?tag=${ab(0)}`);
  await expect(jonas.getByText(/ · Entwurf$/)).toBeVisible();
  await veroeffentlichenKnopf(jonas).click();
  await expect(
    jonas
      .getByRole("status")
      .filter({ hasText: t("plan_veroeffentlicht", { anzahl: 1, personen: 0 }) }),
  ).toBeVisible();
  await expect(jonas.getByText(/ · Entwurf$/)).toHaveCount(0);
  await expect(veroeffentlichenKnopf(jonas)).toHaveCount(0);
};

/** Tom issues the link of his calendar in the dialog and reads it from the field */
const linkErstellen = async (tom: Page) => {
  await tom.getByRole("button", { name: t("plan_kalender"), exact: true }).click();
  const dialog = tom.getByRole("dialog", { name: t("plan_kalender_titel") });
  await dialog.getByRole("button", { name: t("plan_kalender_erstellen") }).click();
  const feld = dialog.getByLabel(t("plan_kalender_link"));
  await expect(feld).toHaveValue(/\/api\/v1\/ics\/soll_ics_[\w-]{43}\.ics$/);
  return { dialog, url: await feld.inputValue() };
};

const pruefen = async (jonas: Page, browser: Browser) => {
  const { tom } = await elbblickMitEntwurf(jonas, browser);
  await tom.goto(`/dienstplan?tag=${ab(0)}`);
  await expect(tom.getByText(t("plan_nichts_veroeffentlicht"))).toBeVisible();
  // employees neither publish nor see the button
  await expect(veroeffentlichenKnopf(tom)).toHaveCount(0);

  await veroeffentlichen(jonas);
  await tom.reload();
  await expect(
    tom
      .getByText(/14:00–22:00/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();

  const { dialog, url } = await linkErstellen(tom);
  await expect(dialog.getByRole("link", { name: t("plan_kalender_oeffnen") })).toHaveAttribute(
    "href",
    url.replace(/^https?:/, "webcal:"),
  );
  // what a calendar app reads: Tom's published shift as iCalendar, nothing else
  const feed = await tom.request.get(url, { headers: { cookie: "" } });
  expect(feed.status()).toBe(200);
  expect(feed.headers()["content-type"]).toBe("text/calendar; charset=utf-8");
  const ics = await feed.text();
  expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  expect(ics).toContain("SUMMARY:Schicht · Service\r\n");

  // revoked, the link shows nothing any more
  await dialog.getByRole("button", { name: t("plan_kalender_widerrufen") }).click();
  await expect(dialog.getByRole("button", { name: t("plan_kalender_erstellen") })).toBeVisible();
  expect((await tom.request.get(url, { headers: { cookie: "" } })).status()).toBe(404);
};

test("the owner publishes the week, Tom sees it and subscribes to his calendar", async ({
  page,
  browser,
}) => {
  await pruefen(page, browser);
});

test("publishes and subscribes on a phone @phone", async ({ page, browser }) => {
  await page.setViewportSize({ width: 412, height: 839 });
  await pruefen(page, browser);
});

test("a new link replaces the old one at once", async ({ page, browser }) => {
  const { tom } = await elbblickMitEntwurf(page, browser);
  await veroeffentlichen(page);
  await tom.goto(`/dienstplan?tag=${ab(0)}`);
  const { dialog, url } = await linkErstellen(tom);
  await expect(dialog.getByText(t("plan_kalender_neu_hinweis"), { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: t("plan_kalender_neu") }).click();
  await expect(dialog.getByLabel(t("plan_kalender_link"))).not.toHaveValue(url);
  expect((await tom.request.get(url, { headers: { cookie: "" } })).status()).toBe(404);
});

for (const theme of ["light", "dark"] as const) {
  test(`axe finds nothing on a published week and the calendar dialog in ${theme} @phone`, async ({
    page,
    browser,
  }) => {
    const { tom } = await elbblickMitEntwurf(page, browser);
    await page.emulateMedia({ colorScheme: theme });
    await tom.emulateMedia({ colorScheme: theme });
    await veroeffentlichen(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await tom.goto(`/dienstplan?tag=${ab(0)}`);
    await expect(
      tom
        .getByText(/14:00–22:00/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await linkErstellen(tom);
    expect((await new AxeBuilder({ page: tom }).analyze()).violations).toEqual([]);
  });
}
