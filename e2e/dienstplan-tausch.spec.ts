import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, senden, zweiterBrowser } from "./betrieb.ts";
import { ab, angabenSetzen, t } from "./plan.ts";

/*
 * The shift swap (S-504): Tom offers his published late shift, Yusuf takes it over, the owner sees
 * the check for Yusuf and approves; then the shift is Yusuf's.
 */

test.use({ locale: "de" });

type Tausch = { jonas: Page; tom: Page; yusuf: Page; yusufId: string; standortId: string };

/** A business with its site, Tom's late shift on the Monday of next week published, and Yusuf */
const mitVeroeffentlichterSchicht = async (jonas: Page, browser: Browser): Promise<Tausch> => {
  await betriebAnlegen(jonas);
  await senden(jonas, "POST", "/api/v1/standorte", { name: "Elbe", land: "HH" });
  const tom = await zweiterBrowser(browser, test.info());
  const tomId = await einladungAnnehmen(jonas, tom, "Tom Berger");
  const yusuf = await zweiterBrowser(browser, test.info());
  const yusufId = await einladungAnnehmen(jonas, yusuf, "Yusuf Demir");
  const { standorte } = (await (await jonas.request.get("/api/v1/standorte")).json()) as {
    standorte: { standortId: string }[];
  };
  const standortId = standorte[0]?.standortId ?? "";
  await senden(jonas, "POST", "/api/v1/dienstplan/schichten", {
    standortId,
    tag: ab(0),
    beginnMinute: 14 * 60,
    endeMinute: 22 * 60,
    pauseMinuten: 30,
    rolle: "Service",
    nutzerId: tomId,
  });
  await senden(jonas, "POST", "/api/v1/dienstplan/veroeffentlichen", { standortId, tag: ab(0) });
  return { jonas, tom, yusuf, yusufId, standortId };
};

const bereich = (page: Page) => page.getByRole("region", { name: t("plan_tausch_titel") });

/** Tom offers his shift to everyone in the dialog */
const anbieten = async (tom: Page) => {
  await tom.goto(`/dienstplan?tag=${ab(0)}`);
  await bereich(tom)
    .getByRole("button", { name: t("plan_tausch_anbieten") })
    .click();
  const dialog = tom.getByRole("dialog", { name: t("plan_tausch_anbieten") });
  await expect(dialog.getByLabel(t("plan_tausch_an"))).toHaveValue("");
  await dialog.getByRole("button", { name: t("plan_tausch_senden") }).click();
  await expect(dialog).toHaveCount(0);
  await expect(bereich(tom).getByText(t("plan_tausch_status_offen"))).toBeVisible();
};

/** Yusuf takes it over */
const uebernehmen = async (yusuf: Page) => {
  await yusuf.goto(`/dienstplan?tag=${ab(0)}`);
  await bereich(yusuf)
    .getByRole("button", { name: t("plan_tausch_uebernehmen") })
    .click();
  await expect(bereich(yusuf).getByText(t("plan_tausch_status_uebernommen"))).toBeVisible();
};

const personDerSchicht = async (c: Tausch) => {
  const woche = (await (
    await c.jonas.request.get(`/api/v1/dienstplan/woche?standortId=${c.standortId}&tag=${ab(0)}`)
  ).json()) as { schichten: { nutzerId: string | null }[] };
  return woche.schichten[0]?.nutzerId;
};

const tauschen = async (jonas: Page, browser: Browser) => {
  const c = await mitVeroeffentlichterSchicht(jonas, browser);
  await anbieten(c.tom);
  await uebernehmen(c.yusuf);
  await jonas.goto(`/dienstplan?tag=${ab(0)}`);
  const eintrag = bereich(jonas).getByRole("listitem").filter({ hasText: "Yusuf Demir" });
  await expect(eintrag.getByText(t("plan_tausch_befunde_keine"))).toBeVisible();
  // the shift stays Tom's until the owner approves
  expect(await personDerSchicht(c)).not.toBe(c.yusufId);
  await eintrag.getByRole("button", { name: t("plan_tausch_freigeben") }).click();
  await expect(eintrag.getByText(t("plan_tausch_status_freigegeben"))).toBeVisible();
  expect(await personDerSchicht(c)).toBe(c.yusufId);
  await c.yusuf.reload();
  await expect(bereich(c.yusuf).getByText(t("plan_tausch_status_freigegeben"))).toBeVisible();
};

test("Tom offers his shift, Yusuf takes it, the owner approves", async ({ page, browser }) => {
  await tauschen(page, browser);
});

test("swaps a shift on a phone @phone", async ({ page, browser }) => {
  await tauschen(page, browser);
});

test("the owner sees the check for Yusuf and refuses with a reason Tom reads", async ({
  page,
  browser,
}) => {
  const c = await mitVeroeffentlichterSchicht(page, browser);
  await angabenSetzen(page, c.yusufId, { mutterschutz: [{ von: ab(-30), bis: null }] });
  await anbieten(c.tom);
  await uebernehmen(c.yusuf);
  // the colleagues never see a finding (Art. 9 DSGVO)
  await expect(c.yusuf.locator("[data-regel]")).toHaveCount(0);
  await page.goto(`/dienstplan?tag=${ab(0)}`);
  const eintrag = bereich(page).getByRole("listitem").filter({ hasText: "Yusuf Demir" });
  await expect(eintrag.locator('[data-regel="R-21"]').first()).toBeVisible();
  await eintrag.getByRole("button", { name: t("plan_tausch_ablehnen") }).click();
  const dialog = page.getByRole("dialog", { name: t("plan_tausch_ablehnen") });
  await dialog.getByRole("button", { name: t("plan_tausch_ablehnen") }).click();
  await expect(dialog.getByRole("alert")).toHaveText(t("plan_tausch_grund_fehlt"));
  await dialog.getByLabel(t("plan_tausch_grund")).fill("Besetzung am Montag geändert");
  await dialog.getByRole("button", { name: t("plan_tausch_ablehnen") }).click();
  await expect(dialog).toHaveCount(0);
  await c.tom.reload();
  await expect(
    bereich(c.tom).getByText(
      t("plan_tausch_grund_anzeige", { grund: "Besetzung am Montag geändert" }),
    ),
  ).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`axe finds nothing on the swap and its dialogs in ${theme} @phone`, async ({
    page,
    browser,
  }) => {
    const c = await mitVeroeffentlichterSchicht(page, browser);
    for (const p of [page, c.tom, c.yusuf]) await p.emulateMedia({ colorScheme: theme });
    await c.tom.goto(`/dienstplan?tag=${ab(0)}`);
    await bereich(c.tom)
      .getByRole("button", { name: t("plan_tausch_anbieten") })
      .click();
    await expect(c.tom.getByRole("dialog", { name: t("plan_tausch_anbieten") })).toBeVisible();
    expect((await new AxeBuilder({ page: c.tom }).analyze()).violations).toEqual([]);
    await anbieten(c.tom);
    await uebernehmen(c.yusuf);
    expect((await new AxeBuilder({ page: c.yusuf }).analyze()).violations).toEqual([]);
    await page.goto(`/dienstplan?tag=${ab(0)}`);
    await bereich(page)
      .getByRole("button", { name: t("plan_tausch_ablehnen") })
      .click();
    await expect(page.getByRole("dialog", { name: t("plan_tausch_ablehnen") })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
