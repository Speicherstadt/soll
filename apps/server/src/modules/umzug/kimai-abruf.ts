import { plusTage, type Tag } from "@soll/arbeitszeit";
import { type KimaiAbzug, MAX_DATENSAETZE } from "@soll/import";
import { instanzVon } from "./kimai-adresse.ts";
import type { Antwort, Holen } from "./kimai-holen.ts";

/*
 * The fetch from Kimai's REST API (BAULISTE.md S-705), built after Kimai's source
 * (github.com/kimai/kimai 2.73.0): the endpoints and filters in src/API/*Controller.php, the paging
 * headers in src/API/ViewHandler.php, the access in src/API/Authentication/. The access goes with
 * this one fetch and is kept nowhere (docs/plan.md, "API-Zugang eines Werkzeugs"); requests go one
 * after the other, and a refusal is an answer, not a retry.
 */

export type KimaiDeps = {
  holen: Holen;
  /** origins the operator allows to be http and private (SOLL_IMPORT_ALLOWED_ORIGINS) */
  erlaubt: ReadonlySet<string>;
};

/** The instance, its API token and, for an older Kimai, the user name of X-AUTH-USER */
export type KimaiZugang = { instanz: string; token: string; benutzer: string | null };

export type KimaiFehler =
  | { grund: "adresse_ungueltig" }
  | { grund: "adresse_intern" }
  | { grund: "weiterleitung" }
  | { grund: "zugang_ungueltig" }
  | { grund: "zugang_abgelehnt" }
  | { grund: "rechte_fehlen" }
  | { grund: "zu_viele_anfragen"; wiederholenNach: number | null }
  | { grund: "nicht_erreichbar" }
  | { grund: "antwort_ungueltig" }
  | { grund: "antwort_zu_gross" }
  | { grund: "zu_viele" };
type Ergebnis<T> = { ok: true; wert: T } | ({ ok: false } & KimaiFehler);

/** The largest page Kimai gives (BaseApiController::MAX_PAGE_SIZE) */
const SEITE = 500;
/** The most pages of timesheets: 20,000 records and one page more */
const MAX_SEITEN = Math.ceil(MAX_DATENSAETZE / SEITE) + 1;
/** The whole fetch: a year of 20,000 timesheets is 40 pages */
const GESAMT_MS = 5 * 60_000;

/**
 * The headers of every request: the API token as a bearer (ApiRequestMatcher.php), or for a Kimai
 * before API tokens the user and the API password (TokenAuthenticator.php, X-AUTH-USER and
 * X-AUTH-TOKEN, which 2.73 refuses)
 */
/**
 * Whether a token or user name can go as a header value: visible ASCII with spaces inside only.
 * node:http throws on a character outside Latin-1 or a line break (RFC 9110, 5.5), and Kimai
 * reads the bytes as they come, so a name of other letters could not be matched either.
 */
const KOPFWERT = /^[\x21-\x7e](?:[\x20-\x7e]*[\x21-\x7e])?$/;

const zugangSendbar = (zugang: KimaiZugang): boolean =>
  KOPFWERT.test(zugang.token) && (zugang.benutzer === null || KOPFWERT.test(zugang.benutzer));

const kopfzeilen = (zugang: KimaiZugang): Record<string, string> => ({
  Accept: "application/json",
  "User-Agent": "Soll",
  ...(zugang.benutzer
    ? { "X-AUTH-USER": zugang.benutzer, "X-AUTH-TOKEN": zugang.token }
    : { Authorization: `Bearer ${zugang.token}` }),
});

const sekundenAus = (kopf: string | null): number | null => {
  const zahl = kopf === null ? Number.NaN : Number(kopf);
  return Number.isInteger(zahl) && zahl >= 0 ? zahl : null;
};

/** What a status says, or null for a JSON body to read */
const statusFehler = (antwort: Antwort): KimaiFehler | null => {
  if (antwort.status === 401) return { grund: "zugang_abgelehnt" };
  if (antwort.status === 403) return { grund: "rechte_fehlen" };
  if (antwort.status === 429)
    return {
      grund: "zu_viele_anfragen",
      wiederholenNach: sekundenAus(antwort.kopf("retry-after")),
    };
  if (antwort.status >= 500) return { grund: "nicht_erreichbar" };
  return antwort.status === 200 ? null : { grund: "antwort_ungueltig" };
};

type Kontext = {
  deps: KimaiDeps;
  zugang: KimaiZugang;
  basis: string;
  nurOeffentlich: boolean;
  frist: number;
};

/** One GET of a list, its array and its headers, or why there is none */
const holen = async (
  k: Kontext,
  pfad: string,
  abfrage: Record<string, string | number>,
): Promise<Ergebnis<{ liste: unknown[]; antwort: Antwort }>> => {
  if (Date.now() > k.frist) return { ok: false, grund: "nicht_erreichbar" };
  const url = new URL(`${k.basis}${pfad}`);
  for (const [name, wert] of Object.entries(abfrage)) url.searchParams.set(name, String(wert));
  const abgerufen = await k.deps.holen(url, kopfzeilen(k.zugang), k.nurOeffentlich);
  if (!abgerufen.ok)
    return {
      ok: false,
      grund: abgerufen.grund === "zu_gross" ? "antwort_zu_gross" : abgerufen.grund,
    };
  const fehler = statusFehler(abgerufen.wert);
  if (fehler) return { ok: false, ...fehler };
  try {
    const liste: unknown = JSON.parse(abgerufen.wert.text);
    return Array.isArray(liste)
      ? { ok: true, wert: { liste, antwort: abgerufen.wert } }
      : { ok: false, grund: "antwort_ungueltig" };
  } catch {
    return { ok: false, grund: "antwort_ungueltig" };
  }
};

/** The number of pages Kimai names (`X-Total-Pages`), or null */
const seitenzahl = (antwort: Antwort): number | null => {
  const zahl = Number(antwort.kopf("x-total-pages"));
  return Number.isInteger(zahl) && zahl >= 0 ? zahl : null;
};

/** A local date-time as Kimai's filters take it (`Y-m-d\TH:i:s`, the token user's time zone) */
const lokal = (tag: Tag, uhrzeit: string) => `${tag}T${uhrzeit}`;

/**
 * Every timesheet that begins in the period, page by page in the order of their begin. Kimai reads
 * `begin` and `end` in the time zone of the token's user, which Soll does not know: a day more on
 * each side, and the reader keeps what begins on a Berlin day of the period
 */
const zeitbuchungen = async (
  k: Kontext,
  zeitraum: { von: Tag; bis: Tag },
  bisher: number,
): Promise<Ergebnis<unknown[]>> => {
  const saetze: unknown[] = [];
  for (let seite = 1, seiten = 1; seite <= seiten; seite++) {
    const geholt = await holen(k, "/api/timesheets", {
      user: "all",
      begin: lokal(plusTage(zeitraum.von, -1), "00:00:00"),
      end: lokal(plusTage(zeitraum.bis, 1), "23:59:59"),
      size: SEITE,
      page: seite,
      orderBy: "begin",
      order: "ASC",
    });
    if (!geholt.ok) return geholt;
    const zahl = seitenzahl(geholt.wert.antwort);
    if (zahl === null) return { ok: false, grund: "antwort_ungueltig" };
    saetze.push(...geholt.wert.liste);
    if (bisher + saetze.length > MAX_DATENSAETZE || zahl > MAX_SEITEN)
      return { ok: false, grund: "zu_viele" };
    seiten = zahl;
  }
  return { ok: true, wert: saetze };
};

/** Users, customers, projects and activities (hidden ones too), then the period's timesheets */
export const kimaiAbrufen = async (
  deps: KimaiDeps,
  zugang: KimaiZugang,
  zeitraum: { von: Tag; bis: Tag },
): Promise<Ergebnis<KimaiAbzug>> => {
  const instanz = instanzVon(zugang.instanz, deps.erlaubt);
  if (instanz === null) return { ok: false, grund: "adresse_ungueltig" };
  if (!zugangSendbar(zugang)) return { ok: false, grund: "zugang_ungueltig" };
  const k: Kontext = { deps, zugang, ...instanz, frist: Date.now() + GESAMT_MS };
  const listen = [
    ["user", "/api/users", { visible: 3 }],
    ["customer", "/api/customers", { visible: 3 }],
    ["project", "/api/projects", { visible: 3, ignoreDates: 1 }],
    ["activity", "/api/activities", { visible: 3 }],
  ] as const;
  const abzug: KimaiAbzug = {
    ...zeitraum,
    user: [],
    customer: [],
    project: [],
    activity: [],
    timesheet: [],
  };
  let bisher = 0;
  for (const [art, pfad, abfrage] of listen) {
    const geholt = await holen(k, pfad, abfrage);
    if (!geholt.ok) return geholt;
    abzug[art] = geholt.wert.liste;
    bisher += geholt.wert.liste.length;
    if (bisher > MAX_DATENSAETZE) return { ok: false, grund: "zu_viele" };
  }
  const zeiten = await zeitbuchungen(k, zeitraum, bisher);
  if (!zeiten.ok) return zeiten;
  return { ok: true, wert: { ...abzug, timesheet: zeiten.wert } };
};
