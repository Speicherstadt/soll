import { expect, type Page } from "@playwright/test";
import { betriebAnlegen, senden } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

/*
 * Helpers of the checks of the plan (S-502): a business with a site, its owner as the person
 * planned, days counted from the Monday of next week so every case lies ahead of today.
 */

const de = messagesOf("de");
export const t = (key: string, werte: Record<string, string | number> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, String(wert)),
    de[key] ?? key,
  );

const TAG_MS = 86_400_000;

/** Today in Berlin */
export const heute = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(Date.now());

/** A day `tage` after another, read at noon UTC so no time zone moves it */
export const plus = (tag: string, tage: number) =>
  new Date(Date.parse(`${tag}T12:00:00Z`) + tage * TAG_MS).toISOString().slice(0, 10);

/** The Monday of next week in Berlin plus `tage`: Monday 0, Sunday 6, the Monday after 7 */
export const ab = (tage: number) => {
  const mittag = new Date(`${heute()}T12:00:00Z`);
  const montag = plus(heute(), -((mittag.getUTCDay() + 6) % 7));
  return plus(montag, 7 + tage);
};

/** A business in Hamburg with one site; its owner Jonas Weber is planned */
export const betriebMitPlan = async (page: Page) => {
  await betriebAnlegen(page);
  await senden(page, "POST", "/api/v1/standorte", { name: "Elbe", land: "HH" });
  const { nutzerId } = (await (await page.request.get("/api/v1/betrieb")).json()) as {
    nutzerId: string;
  };
  const { standorte } = (await (await page.request.get("/api/v1/standorte")).json()) as {
    standorte: { standortId: string }[];
  };
  return { nutzerId, standortId: standorte[0]?.standortId ?? "" };
};

const minute = (uhrzeit: string) => {
  const [stunden = 0, minuten = 0] = uhrzeit.split(":").map(Number);
  return stunden * 60 + minuten;
};

/** Plans a shift for the person on a day from one time to another, with a break in minutes */
export const planen = (
  page: Page,
  ort: { nutzerId: string; standortId: string },
  tag: string,
  von: string,
  bis: string,
  pauseMinuten = 0,
) =>
  senden(page, "POST", "/api/v1/dienstplan/schichten", {
    standortId: ort.standortId,
    nutzerId: ort.nutzerId,
    tag,
    beginnMinute: minute(von),
    endeMinute: minute(bis),
    pauseMinuten,
    rolle: "Service",
  }) as Promise<{ schichtId: string }>;

/** What the owner enters for a person (PUT /api/v1/personen/:id/angaben) */
export const angabenSetzen = (
  page: Page,
  nutzerId: string,
  angaben: Partial<{
    geburtsdatum: string | null;
    wechselschicht: boolean;
    abruf: boolean;
    mutterschutz: { von: string; bis: string | null }[];
  }>,
) =>
  senden(page, "PUT", `/api/v1/personen/${nutzerId}/angaben`, {
    geburtsdatum: null,
    wechselschicht: false,
    abruf: false,
    mutterschutz: [],
    ...angaben,
  });

/** A model with a wage, assigned to the person from today (R-14, R-32) */
export const modellMitLohn = async (
  page: Page,
  nutzerId: string,
  lohn: { lohnArt: "monat" | "stunde"; lohnCent: number; minijob: boolean },
) => {
  const modell = await senden(page, "POST", "/api/v1/arbeitszeit/modelle", {
    name: "Plan",
    sollMinuten: [0, 0, 0, 0, 0, 0, 0],
    gueltigAb: heute(),
    ...lohn,
  });
  await senden(page, "PUT", `/api/v1/arbeitszeit/personen/${nutzerId}/modell`, {
    modellId: modell.modellId,
    gueltigAb: heute(),
  });
};

/** The list "Hinweise zum Plan" below the grid */
export const hinweise = (page: Page) => page.getByRole("region", { name: /^Hinweise zum Plan/ });

/** Opens the week of a day and expects a finding of the rule in the list and on the block */
export const befundZeigt = async (
  page: Page,
  tag: string,
  regel: string,
  titel: string,
  ort: { nutzerId: string },
) => {
  await page.goto(`/dienstplan?tag=${tag}`);
  const eintrag = hinweise(page).locator(`[data-regel="${regel}"]`).first();
  await expect(eintrag).toContainText(titel);
  await expect(eintrag).toContainText("Jonas Weber");
  const block = page.locator(`[data-zelle="${ort.nutzerId}:${tag}"]`);
  await expect(block.locator("button[draggable]").first()).toContainText(titel);
  return eintrag;
};
