import { createSignal } from "solid-js";
import { abfrageCache } from "../abfragen/client.ts";
import { api } from "../api.ts";
import { ALLE_MODULE } from "../rahmen/module.ts";
import type { Betrieb, Zustand } from "./ziel.ts";

/**
 * The person and business of this browser: asked of the server once, again after signing in, setting
 * up or switching modules. The business as last seen stays on the device (a convenience for opening
 * the app offline), never what the server decides: every route checks the session there again.
 */
const SCHLUESSEL = "soll.betrieb";

const ablage = (): Storage | undefined => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
};

const gemerkt = (): Betrieb | null => {
  try {
    return JSON.parse(ablage()?.getItem(SCHLUESSEL) ?? "null") as Betrieb | null;
  } catch {
    return null;
  }
};

const merken = (betrieb: Betrieb | null): void => {
  try {
    if (betrieb) ablage()?.setItem(SCHLUESSEL, JSON.stringify(betrieb));
    else ablage()?.removeItem(SCHLUESSEL);
  } catch {
    // storage blocked: the app asks the server next time
  }
};

const [zustand, setZustand] = createSignal<Zustand>({ art: "offline", betrieb: gemerkt() });

export const sitzung = zustand;

/** Whose data the app shows: the person in a business, or nobody */
const person = (z: Zustand): string =>
  (z.art === "bereit" || z.art === "offline") && z.betrieb
    ? `${z.betrieb.betriebId}/${z.betrieb.nutzerId}`
    : "";

/**
 * The cached answers belong to one person in one business: another one (signed out, another
 * account, another business) never sees them, not even for the moment a page loads again
 */
const setze = (neu: Zustand): void => {
  if (person(neu) !== person(zustand())) abfrageCache.clear();
  setZustand(neu);
};

/** The modules whose areas the navigation shows */
export const aktuelleModule = () => {
  const z = zustand();
  return z.art === "bereit"
    ? z.betrieb.module
    : z.art === "offline"
      ? (z.betrieb?.module ?? ALLE_MODULE)
      : ALLE_MODULE;
};

export const aktuellerBetrieb = (): Betrieb | null => {
  const z = zustand();
  return z.art === "bereit" || z.art === "offline" ? z.betrieb : null;
};

/**
 * A member signing in has no business chosen yet (Better Auth leaves it empty): the first business of
 * the account becomes the active one
 */
const ersterBetriebAktiv = async (): Promise<boolean> => {
  const liste = await api<{ id: string }[]>("/api/auth/organization/list");
  const erster = liste.ok ? liste.daten[0] : undefined;
  if (!erster) return false;
  return (await api("/api/auth/organization/set-active", { body: { organizationId: erster.id } }))
    .ok;
};

const abfragen = async (nochmal = true): Promise<Zustand> => {
  const antwort = await api<Betrieb>("/api/v1/betrieb");
  if (antwort.ok) return { art: "bereit", betrieb: antwort.daten };
  if (antwort.status === 401) return { art: "abgemeldet" };
  if (antwort.status === 403 && ["kein_betrieb", "kein_mitglied"].includes(antwort.fehler)) {
    return nochmal && (await ersterBetriebAktiv()) ? abfragen(false) : { art: "ohne_betrieb" };
  }
  return { art: "offline", betrieb: gemerkt() };
};

let laufend: Promise<Zustand> | null = null;

/** The session, asked of the server once per page load */
export const sitzungLaden = (): Promise<Zustand> => {
  if (laufend) return laufend;
  const diese: Promise<Zustand> = abfragen().then((neu) => {
    // an answer to a question asked again since (sitzungNeu) was read before what changed
    if (laufend !== diese) return laufend ?? neu;
    setze(neu);
    if (neu.art !== "offline") merken(neu.art === "bereit" ? neu.betrieb : null);
    return neu;
  });
  laufend = diese;
  return diese;
};

/** Asks the server again, after signing in or out, setting up or switching modules */
export const sitzungNeu = (): Promise<Zustand> => {
  laufend = null;
  return sitzungLaden();
};

/**
 * The server ended the session: what this device stored of the business goes now, whatever the
 * next question to the server brings, so the next person here never sees it, not even offline
 */
export const abgemeldet = (): void => {
  merken(null);
  const neu: Zustand = { art: "abgemeldet" };
  setze(neu);
  laufend = Promise.resolve(neu);
};
