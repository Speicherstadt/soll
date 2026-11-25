import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { APIRequestContext, Browser, BrowserContext, Page } from "@playwright/test";
import {
  type Aufnahme,
  festerTeil,
  GERAETE,
  PIXELDICHTE,
  type Schritt,
  type Thema,
  type Wer,
} from "./bildschirme.ts";

/** What the screenshot server reports (apps/server/src/screenshots/server.ts, BilderStand) */
export type Stand = {
  url: string;
  jetzt: number;
  passwort: string;
  anmeldungen: { betrieb: string; anmeldung: string }[];
  betriebe: { schluessel: string; name: string; betriebId: string }[];
  pruefwert: { betriebId: string; pruefwert: string } | null;
};

/** The café's tablet as the app keeps its pairing (apps/web/src/terminal/geraet.ts) */
export type Kopplung = { token: string; terminalId: string; name: string; betrieb: string };

export type Umgebung = {
  browser: Browser;
  stand: Stand;
  texte: Readonly<Record<string, string>>;
  kopplung: Kopplung;
  ziel: string;
};

const text = (texte: Umgebung["texte"], schluessel: string): string => {
  const wert = texte[schluessel];
  if (wert === undefined) throw new Error(`no message ${schluessel} in messages/de.json`);
  return wert;
};

const erwarten = async <T = unknown>(
  antwort: Awaited<ReturnType<APIRequestContext["post"]>>,
  was: string,
): Promise<T> => {
  if (!antwort.ok()) throw new Error(`${was}: ${antwort.status()} ${await antwort.text()}`);
  return (await antwort.json()) as T;
};

/** Signs a browser context in as a person of the demo and makes their business the active one */
export const anmelden = async (request: APIRequestContext, stand: Stand, anmeldung: string) => {
  const person = stand.anmeldungen.find((a) => a.anmeldung === anmeldung);
  const betriebId = stand.betriebe.find((b) => b.name === person?.betrieb)?.betriebId;
  if (!person || !betriebId) throw new Error(`no sign-in ${anmeldung} in the demo`);
  const headers = { origin: stand.url };
  const perMail = anmeldung.includes("@");
  await erwarten(
    await request.post(`/api/auth/sign-in/${perMail ? "email" : "username"}`, {
      headers,
      data: perMail
        ? { email: anmeldung, password: stand.passwort }
        : { username: anmeldung, password: stand.passwort },
    }),
    `sign in ${anmeldung}`,
  );
  await erwarten(
    await request.post("/api/auth/organization/set-active", {
      headers,
      data: { organizationId: betriebId },
    }),
    `set active ${anmeldung}`,
  );
};

/** Pairs one more tablet with the café, with a code of its owner, as on the terminal's screen */
export const tabletKoppeln = async (browser: Browser, stand: Stand): Promise<Kopplung> => {
  const inhaberin = await browser.newContext({ baseURL: stand.url });
  const tablet = await browser.newContext({ baseURL: stand.url });
  const headers = { origin: stand.url };
  try {
    await anmelden(inhaberin.request, stand, "mia@cafe-elbblick.test");
    const { code } = await erwarten<{ code: string }>(
      await inhaberin.request.post("/api/v1/terminal/geraete", {
        headers,
        data: { name: "Tresen" },
      }),
      "terminal code",
    );
    return await erwarten<Kopplung>(
      await tablet.request.post("/api/v1/kiosk/koppeln", { headers, data: { code } }),
      "pairing",
    );
  } finally {
    await inhaberin.close();
    await tablet.close();
  }
};

/** Theme of the app's setting (apps/web/src/rahmen/theme.ts) and, on the tablet, its pairing */
const ablageVorbereiten = (werte: { thema: Thema; kopplung: string | null }) => {
  localStorage.setItem("soll-thema", werte.thema === "dark" ? "dunkel" : "hell");
  if (werte.kopplung) localStorage.setItem("soll.kiosk", werte.kopplung);
};

/** A browser of the device in the theme, the clock standing still, signed in as `wer` */
const kontextOeffnen = async (u: Umgebung, a: Aufnahme): Promise<BrowserContext> => {
  const geraet = GERAETE[a.geraet];
  const kontext = await u.browser.newContext({
    baseURL: u.stand.url,
    viewport: { width: geraet.breite, height: geraet.hoehe },
    deviceScaleFactor: PIXELDICHTE,
    isMobile: geraet.mobil,
    hasTouch: a.geraet !== "desktop",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    colorScheme: a.thema,
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await kontext.clock.setFixedTime(u.stand.jetzt);
  const wer: Wer = a.bildschirm.wer;
  await kontext.addInitScript(ablageVorbereiten, {
    thema: a.thema,
    kopplung: wer === "terminal" ? JSON.stringify(u.kopplung) : null,
  });
  if (typeof wer === "object") await anmelden(kontext.request, u.stand, wer.anmeldung);
  return kontext;
};

const schrittAusfuehren = async (u: Umgebung, seite: Page, schritt: Schritt) => {
  if (schritt === "pruefwert") {
    if (!u.stand.pruefwert) throw new Error("the demo closed no month for the Prüfseite");
    await seite.getByLabel(text(u.texte, "pruefen_wert")).fill(u.stand.pruefwert.pruefwert);
    await seite.getByRole("button", { name: text(u.texte, "pruefen_knopf") }).click();
  } else {
    await seite
      .getByText(festerTeil(text(u.texte, schritt.warten)))
      .first()
      .waitFor();
  }
};

/** The path, with the business of the Prüfwert filled in on the Prüfseite */
const adresse = (u: Umgebung, a: Aufnahme): string =>
  a.bildschirm.pfad === "/pruefen" && u.stand.pruefwert
    ? `/pruefen?betrieb=${u.stand.pruefwert.betriebId}`
    : a.bildschirm.pfad;

/**
 * Opens the screen, runs its steps and checks the heading; a screen that does not show what it
 * should fails the run instead of writing a wrong picture
 */
export const aufnehmen = async (u: Umgebung, a: Aufnahme): Promise<string> => {
  const kontext = await kontextOeffnen(u, a);
  try {
    const seite = await kontext.newPage();
    await seite.goto(adresse(u, a));
    const titel = festerTeil(text(u.texte, a.bildschirm.titel));
    await seite.locator("h1", { hasText: titel }).first().waitFor({ state: "attached" });
    for (const schritt of a.bildschirm.schritte ?? []) await schrittAusfuehren(u, seite, schritt);
    await seite.waitForLoadState("networkidle");
    await seite.evaluate(() => document.fonts.ready.then(() => undefined));
    mkdirSync(u.ziel, { recursive: true });
    const datei = join(u.ziel, a.datei);
    await seite.screenshot({ path: datei, animations: "disabled", caret: "hide" });
    return datei;
  } finally {
    await kontext.close();
  }
};
