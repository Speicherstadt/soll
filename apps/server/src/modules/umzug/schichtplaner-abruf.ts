import { MAX_DATENSAETZE } from "@soll/import";
import { type KimaiFehler, statusFehler } from "./kimai-abruf.ts";
import type { Holen } from "./kimai-holen.ts";

/*
 * What the fetches from the shift planners share (BAULISTE.md S-706: Papershift, Planday,
 * Crewmeister): requests one after the other at an address of the tool (never one the owner
 * types), a JSON body or why there is none, and lists page by page until the tool says there are
 * no more. The access goes with this one fetch and is kept nowhere; an error names its reason and
 * nothing of the request, so a token in an address (Papershift's `api_token`) is in no answer.
 */

/** Where the tools' APIs are; the tests point the server at stand-ins (SOLL_*_API) */
export const SCHICHTPLANER_ADRESSEN = {
  papershift: "https://app.papershift.com/public_api/v1",
  planday: "https://openapi.planday.com",
  plandayId: "https://id.planday.com",
  crewmeister: "https://api.crewmeister.com",
} as const;

export type SchichtplanerAdressen = { [K in keyof typeof SCHICHTPLANER_ADRESSEN]: string };
export type SchichtplanerDeps = { holen: Holen; adressen: SchichtplanerAdressen };

/** The reasons of Kimai's fetch (S-705); an address the owner typed is never one */
export type SchichtplanerFehler = KimaiFehler;
export type Ergebnis<T> = { ok: true; wert: T } | ({ ok: false } & SchichtplanerFehler);

/** The whole fetch: a year of 20,000 records is a few hundred pages */
const GESAMT_MS = 5 * 60_000;
/** The longest token Soll sends on */
const MAX_TOKEN = 8192;
/** Visible ASCII: what a header value may hold (RFC 9110, 5.5) */
const KOPFTEXT = /^[\x21-\x7e]+$/;

export type Kontext = {
  holen: Holen;
  kopf: Record<string, string>;
  nurOeffentlich: boolean;
  frist: number;
};

/** The context of a fetch: whether the address must be public is whether it is the tool's own */
export const kontextVon = (
  deps: SchichtplanerDeps,
  echt: string,
  basis: string,
  kopf: Record<string, string>,
): Kontext => ({
  holen: deps.holen,
  kopf: { Accept: "application/json", "User-Agent": "Soll", ...kopf },
  nurOeffentlich: basis === echt,
  frist: Date.now() + GESAMT_MS,
});

/**
 * One request, its JSON, or why there is none. With a body it is a POST, and every POST of these
 * fetches is a login: there 400 means the access is wrong, as 401 does (OAuth 2.0 answers
 * `invalid_grant` with 400, RFC 6749 5.2)
 */
export const jsonHolen = async (
  k: Kontext,
  url: URL,
  koerper?: { text: string; typ: string },
): Promise<Ergebnis<unknown>> => {
  if (Date.now() > k.frist) return { ok: false, grund: "nicht_erreichbar" };
  const kopf = koerper ? { ...k.kopf, "Content-Type": koerper.typ } : k.kopf;
  const abgerufen = await k.holen(url, kopf, k.nurOeffentlich, koerper?.text);
  if (!abgerufen.ok)
    return {
      ok: false,
      grund: abgerufen.grund === "zu_gross" ? "antwort_zu_gross" : abgerufen.grund,
    };
  if (koerper && abgerufen.wert.status === 400) return { ok: false, grund: "zugang_abgelehnt" };
  const fehler = statusFehler(abgerufen.wert);
  if (fehler) return { ok: false, ...fehler };
  try {
    return { ok: true, wert: JSON.parse(abgerufen.wert.text) as unknown };
  } catch {
    return { ok: false, grund: "antwort_ungueltig" };
  }
};

/** A token from a login answer (`access_token`, `token`), or why it is none */
export const tokenAus = (antwort: unknown, feld: string): Ergebnis<string> => {
  const token =
    typeof antwort === "object" && antwort !== null
      ? (antwort as Record<string, unknown>)[feld]
      : undefined;
  return typeof token === "string" && token.length <= MAX_TOKEN && KOPFTEXT.test(token)
    ? { ok: true, wert: token }
    : { ok: false, grund: "antwort_ungueltig" };
};

/** A page of a list: its records and whether another follows, or null when the body is no page */
export type Seite = { daten: unknown[]; weiter: boolean };

/**
 * Every record of a list, page by page: `url(n)` names page n (from 0), `seite` reads a body;
 * `bisher` counts the records of the lists before. An empty page ends the list, and so does the
 * limit of records: a tool that always says "more" cannot keep a fetch going.
 */
export const alleSeiten = async (
  k: Kontext,
  url: (seite: number) => URL,
  seite: (antwort: unknown) => Seite | null,
  bisher: number,
): Promise<Ergebnis<unknown[]>> => {
  const saetze: unknown[] = [];
  for (let n = 0; ; n++) {
    const geholt = await jsonHolen(k, url(n));
    if (!geholt.ok) return geholt;
    const gelesen = seite(geholt.wert);
    if (gelesen === null) return { ok: false, grund: "antwort_ungueltig" };
    saetze.push(...gelesen.daten);
    if (bisher + saetze.length > MAX_DATENSAETZE) return { ok: false, grund: "zu_viele" };
    if (!gelesen.weiter || gelesen.daten.length === 0) return { ok: true, wert: saetze };
  }
};

/** An address of the tool with its query */
export const adresse = (basis: string, pfad: string, abfrage: Record<string, string | number>) => {
  const url = new URL(`${basis}${pfad}`);
  for (const [name, wert] of Object.entries(abfrage)) url.searchParams.set(name, String(wert));
  return url;
};

/** The records under a key of a JSON object, or null */
export const listeUnter = (antwort: unknown, schluessel: string): unknown[] | null => {
  const wert =
    typeof antwort === "object" && antwort !== null && !Array.isArray(antwort)
      ? (antwort as Record<string, unknown>)[schluessel]
      : undefined;
  return Array.isArray(wert) ? wert : null;
};
