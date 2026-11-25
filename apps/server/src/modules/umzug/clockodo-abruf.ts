import { beginnInBerlin, plusTage, type Tag } from "@soll/arbeitszeit";
import { type Abzug, MAX_DATENSAETZE } from "@soll/import";

/*
 * The fetch from Clockodo's REST API (BAULISTE.md S-703), built after the public SDK `clockodo`
 * (https://github.com/peerigon/clockodo, src/clockodo.ts for the endpoints, src/lib/api.ts for the
 * headers and the paging), docs.clockodo.com being out of reach. The access goes with this one
 * fetch and is kept nowhere (docs/plan.md, "API-Zugang eines Werkzeugs"); requests go one after
 * the other, never in parallel, and a refusal is an answer, not a retry (rate limits).
 */

/** Where Clockodo's API is (SDK src/consts.ts, CLOCKODO_API_BASE_URL) */
export const CLOCKODO_API = "https://my.clockodo.com/api";

export type ClockodoDeps = {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  basis: string;
};
export type Zugang = { nutzer: string; schluessel: string };

export type AbrufFehler =
  | { grund: "zugang_abgelehnt" }
  | { grund: "zu_viele_anfragen"; wiederholenNach: number | null }
  | { grund: "nicht_erreichbar" }
  | { grund: "antwort_ungueltig" }
  | { grund: "zu_viele" };
type Ergebnis<T> = { ok: true; wert: T } | ({ ok: false } & AbrufFehler);

/** How long one request may take; Clockodo answers a page in well under a second */
const ZEITLIMIT_MS = 30_000;
/** The most pages of one list: 20,000 records in pages of at least 100 (SDK `itemsPerPage`) */
const MAX_SEITEN = 200;

/**
 * The headers of every request (SDK src/lib/api.ts and src/lib/requests.ts): the API user and key,
 * the application with a contact (here the API user, who is the business's own contact), and ISO
 * instants in UTC for the entries (`X-ClockodoEnableIsoUtcDateTimes`)
 */
const kopfzeilen = (zugang: Zugang): Record<string, string> => ({
  Accept: "application/json",
  "X-ClockodoApiUser": zugang.nutzer,
  "X-ClockodoApiKey": zugang.schluessel,
  "X-Clockodo-External-Application": `Soll;${zugang.nutzer}`,
  "X-ClockodoEnableIsoUtcDateTimes": "1",
});

type Abfrage = Record<string, string | number | readonly number[]>;

/** Query parameters as the SDK writes them: arrays with brackets (`filter[year][]=2026`) */
const abfrageText = (abfrage: Abfrage): string =>
  Object.entries(abfrage)
    .flatMap(([name, wert]) =>
      Array.isArray(wert)
        ? wert.map((w) => `${encodeURIComponent(`${name}[]`)}=${w}`)
        : [`${encodeURIComponent(name)}=${encodeURIComponent(String(wert))}`],
    )
    .join("&");

const sekundenAus = (kopf: string | null): number | null => {
  const zahl = kopf === null ? Number.NaN : Number(kopf);
  return Number.isInteger(zahl) && zahl >= 0 ? zahl : null;
};

/** One GET, its JSON body, or why there is none */
const holen = async (
  deps: ClockodoDeps,
  zugang: Zugang,
  pfad: string,
  abfrage: Abfrage,
): Promise<Ergebnis<Record<string, unknown>>> => {
  let antwort: Response;
  try {
    antwort = await deps.fetch(`${deps.basis}${pfad}?${abfrageText(abfrage)}`, {
      headers: kopfzeilen(zugang),
      signal: AbortSignal.timeout(ZEITLIMIT_MS),
      // the key goes to Clockodo only, never along a redirect to another host (review S-703)
      redirect: "error",
    });
  } catch {
    return { ok: false, grund: "nicht_erreichbar" };
  }
  if (antwort.status === 401 || antwort.status === 403)
    return { ok: false, grund: "zugang_abgelehnt" };
  if (antwort.status === 429)
    return {
      ok: false,
      grund: "zu_viele_anfragen",
      wiederholenNach: sekundenAus(antwort.headers.get("retry-after")),
    };
  if (!antwort.ok) return { ok: false, grund: "nicht_erreichbar" };
  try {
    const wert: unknown = await antwort.json();
    return typeof wert === "object" && wert !== null && !Array.isArray(wert)
      ? { ok: true, wert: wert as Record<string, unknown> }
      : { ok: false, grund: "antwort_ungueltig" };
  } catch {
    return { ok: false, grund: "antwort_ungueltig" };
  }
};

/** The number of pages a body names (`paging.count_pages`); a list without paging is one page */
const seitenzahl = (body: Record<string, unknown>): number | null => {
  const paging = body.paging;
  if (paging === undefined) return 1;
  const zahl = (paging as { count_pages?: unknown } | null)?.count_pages;
  return typeof zahl === "number" && Number.isInteger(zahl) && zahl >= 0 ? zahl : null;
};

/**
 * Every page of a list, one after the other (SDK `getAllPages`, without its parallel requests);
 * `bisher` records of the fetch came before, and all together stay within one import's limit
 */
const alleSeiten = async (
  deps: ClockodoDeps,
  zugang: Zugang,
  pfad: string,
  feld: "data" | "entries",
  abfrage: Abfrage,
  bisher: number,
): Promise<Ergebnis<unknown[]>> => {
  const saetze: unknown[] = [];
  for (let seite = 1, seiten = 1; seite <= seiten; seite++) {
    const body = await holen(deps, zugang, pfad, { ...abfrage, page: seite });
    if (!body.ok) return body;
    const liste = body.wert[feld];
    const zahl = seitenzahl(body.wert);
    if (!Array.isArray(liste) || zahl === null) return { ok: false, grund: "antwort_ungueltig" };
    saetze.push(...liste);
    if (bisher + saetze.length > MAX_DATENSAETZE || zahl > MAX_SEITEN)
      return { ok: false, grund: "zu_viele" };
    seiten = zahl;
  }
  return { ok: true, wert: saetze };
};

/** An instant as Clockodo takes it in a filter: ISO 8601 in UTC without milliseconds */
const iso = (ms: number): string => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

const jahre = (von: Tag, bis: Tag): number[] => {
  const erstes = Number(von.slice(0, 4));
  return Array.from({ length: Number(bis.slice(0, 4)) - erstes + 1 }, (_, i) => erstes + i);
};

/** An absence that reaches into the period; anything else is left to the reader */
const imZeitraum = (von: Tag, bis: Tag) => (satz: unknown) => {
  const s = satz as { date_since?: unknown; date_until?: unknown } | null;
  return typeof s?.date_since !== "string" || typeof s.date_until !== "string"
    ? true
    : s.date_until >= von && s.date_since <= bis;
};

/**
 * Users, customers, projects, services, the entries of the period (Berlin days `von` to `bis`) and
 * the absences of its years that reach into it; the first refusal ends the fetch
 */
export const clockodoAbrufen = async (
  deps: ClockodoDeps,
  zugang: Zugang,
  zeitraum: { von: Tag; bis: Tag },
): Promise<Ergebnis<Abzug>> => {
  const { von, bis } = zeitraum;
  const listen = [
    ["user", "/v3/users", "data", {}],
    ["customer", "/v3/customers", "data", {}],
    ["project", "/v4/projects", "data", {}],
    ["service", "/v4/services", "data", {}],
    [
      "entry",
      "/v2/entries",
      "entries",
      { time_since: iso(beginnInBerlin(von)), time_until: iso(beginnInBerlin(plusTage(bis, 1))) },
    ],
    ["absence", "/v4/absences", "data", { "filter[year]": jahre(von, bis) }],
  ] as const;
  const abzug: Abzug = {
    von,
    bis,
    user: [],
    customer: [],
    project: [],
    service: [],
    entry: [],
    absence: [],
  };
  // the limit holds for the whole file, as the reader counts its lines (review S-703)
  let bisher = 0;
  for (const [art, pfad, feld, abfrage] of listen) {
    const saetze = await alleSeiten(deps, zugang, pfad, feld, abfrage, bisher);
    if (!saetze.ok) return saetze;
    abzug[art] = art === "absence" ? saetze.wert.filter(imZeitraum(von, bis)) : saetze.wert;
    bisher += abzug[art].length;
  }
  return { ok: true, wert: abzug };
};
