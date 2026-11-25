import type { Tag } from "@soll/arbeitszeit";
import { MAX_DATENSAETZE, type PersonioAbzug } from "@soll/import";
import { type KimaiFehler, KOPFWERT, statusFehler } from "./kimai-abruf.ts";
import type { Holen, VerbindungsFehler } from "./kimai-holen.ts";

/*
 * The fetch from Personio's API v2 (BAULISTE.md S-704). The token after credentials-service-api-v2
 * (developer.personio.de/openapi, mirrored in github.com/Hochfrequenz/personio_client.py: a form
 * with `grant_type=client_credentials`, `client_id` and `client_secret`; `POST /v2/auth/revoke`),
 * the lists with their filters after persons-service-api-v2 and the v2 clients
 * PK-Consulting/n8n-nodes-personio-hr and ninjaneers-team/pysonio (pages by `_meta.links.next.href`
 * with a cursor). The address is Personio's own, never one the owner types; the credentials and the
 * token go with this one fetch and are kept nowhere (docs/plan.md, "API-Zugang eines Werkzeugs").
 * Requests go one after the other, and a refusal is an answer, not a retry.
 */

/** Where Personio's API is; the tests point the server at a stand-in (SOLL_PERSONIO_API) */
export const PERSONIO_API = "https://api.personio.de";

export type PersonioDeps = { holen: Holen; basis: string };
export type PersonioZugang = { clientId: string; clientSecret: string };
/** The reasons of Kimai's fetch (S-705); an address Personio does not have is never one */
export type PersonioFehler = KimaiFehler;
type Ergebnis<T> = { ok: true; wert: T } | ({ ok: false } & PersonioFehler);

/** The whole fetch; a year of 20,000 periods is 200 pages */
const GESAMT_MS = 5 * 60_000;
/** The longest token Soll sends on (Personio's are about 90 characters) */
const MAX_TOKEN = 4096;

type Kontext = { deps: PersonioDeps; token: string; nurOeffentlich: boolean; frist: number };

const KOPF = { Accept: "application/json", "User-Agent": "Soll", "X-Personio-App-ID": "SOLL" };

/** A form as the token endpoint takes it (`application/x-www-form-urlencoded`) */
const senden = (k: Pick<Kontext, "deps" | "nurOeffentlich">, pfad: string, form: object) =>
  k.deps.holen(
    new URL(pfad, k.deps.basis),
    { ...KOPF, "Content-Type": "application/x-www-form-urlencoded" },
    k.nurOeffentlich,
    new URLSearchParams(form as Record<string, string>).toString(),
  );

const alsFehler = (grund: VerbindungsFehler) =>
  ({ ok: false, grund: grund === "zu_gross" ? "antwort_zu_gross" : grund }) as const;

/** The access token for the client, or why there is none (400 and 401: the credentials are wrong) */
const tokenHolen = async (
  k: Pick<Kontext, "deps" | "nurOeffentlich">,
  zugang: PersonioZugang,
): Promise<Ergebnis<string>> => {
  const abgerufen = await senden(k, "/v2/auth/token", {
    grant_type: "client_credentials",
    client_id: zugang.clientId,
    client_secret: zugang.clientSecret,
  });
  if (!abgerufen.ok) return alsFehler(abgerufen.grund);
  const { status, text } = abgerufen.wert;
  if (status === 400 || status === 401) return { ok: false, grund: "zugang_abgelehnt" };
  const fehler = statusFehler(abgerufen.wert);
  if (fehler) return { ok: false, ...fehler };
  try {
    const token: unknown = (JSON.parse(text) as { access_token?: unknown })?.access_token;
    return typeof token === "string" && token.length <= MAX_TOKEN && KOPFWERT.test(token)
      ? { ok: true, wert: token }
      : { ok: false, grund: "antwort_ungueltig" };
  } catch {
    return { ok: false, grund: "antwort_ungueltig" };
  }
};

/** The records of a page and the link to the next one, or null when the body is no list */
const seiteLesen = (text: string): { daten: unknown[]; weiter: unknown } | null => {
  try {
    const seite = JSON.parse(text) as {
      _data?: unknown;
      _meta?: { links?: { next?: { href?: unknown } } };
    };
    return Array.isArray(seite?._data)
      ? { daten: seite._data, weiter: seite._meta?.links?.next?.href }
      : null;
  } catch {
    return null;
  }
};

/**
 * The next page: a link of the same origin and path as the first, not seen before; a link elsewhere
 * would carry the token away, one to a page already read would never end (a forum thread reports a
 * `next` of /v2/persons pointing to itself, Hochfrequenz/personio_client.py, docs/plans)
 */
const naechste = (href: unknown, erste: URL, gesehen: Set<string>): URL | null | "ungueltig" => {
  if (href === undefined || href === null) return null;
  if (typeof href !== "string") return "ungueltig";
  const url = URL.canParse(href, erste) ? new URL(href, erste) : null;
  if (url === null || url.origin !== erste.origin || url.pathname !== erste.pathname)
    return "ungueltig";
  return gesehen.has(url.href) ? "ungueltig" : url;
};

/** Every record of a list, page by page; `bisher` counts the records of the lists before */
const liste = async (
  k: Kontext,
  pfad: string,
  abfrage: Record<string, string>,
  bisher: number,
): Promise<Ergebnis<unknown[]>> => {
  const erste = new URL(pfad, k.deps.basis);
  for (const [name, wert] of Object.entries(abfrage)) erste.searchParams.set(name, wert);
  const gesehen = new Set<string>();
  const saetze: unknown[] = [];
  for (let url: URL | null = erste; url !== null; ) {
    if (Date.now() > k.frist) return { ok: false, grund: "nicht_erreichbar" };
    gesehen.add(url.href);
    const abgerufen = await k.deps.holen(
      url,
      { ...KOPF, Authorization: `Bearer ${k.token}` },
      k.nurOeffentlich,
    );
    if (!abgerufen.ok) return alsFehler(abgerufen.grund);
    const fehler = statusFehler(abgerufen.wert);
    if (fehler) return { ok: false, ...fehler };
    const seite = seiteLesen(abgerufen.wert.text);
    if (seite === null) return { ok: false, grund: "antwort_ungueltig" };
    saetze.push(...seite.daten);
    if (bisher + saetze.length > MAX_DATENSAETZE) return { ok: false, grund: "zu_viele" };
    const weiter = seite.daten.length === 0 ? null : naechste(seite.weiter, erste, gesehen);
    if (weiter === "ungueltig") return { ok: false, grund: "antwort_ungueltig" };
    url = weiter;
  }
  return { ok: true, wert: saetze };
};

/** The lists of a fetch: what Soll reads of persons, absence types and the periods of the period */
const LISTEN = (von: Tag, bis: Tag) =>
  [
    ["person", "/v2/persons", { limit: "50" }],
    ["absence_type", "/v2/absence-types", { limit: "50" }],
    [
      "attendance",
      "/v2/attendance-periods",
      {
        limit: "100",
        "start.date_time.gte": `${von}T00:00:00`,
        "start.date_time.lte": `${bis}T23:59:59`,
      },
    ],
    [
      "absence",
      "/v2/absence-periods",
      {
        limit: "100",
        "starts_from.date_time.lte": `${bis}T23:59:59`,
        "ends_at.date_time.gte": `${von}T00:00:00`,
      },
    ],
  ] as const;

const listenHolen = async (k: Kontext, zeitraum: { von: Tag; bis: Tag }) => {
  const abzug: PersonioAbzug = {
    ...zeitraum,
    person: [],
    absence_type: [],
    attendance: [],
    absence: [],
  };
  let bisher = 0;
  for (const [art, pfad, abfrage] of LISTEN(zeitraum.von, zeitraum.bis)) {
    const geholt = await liste(k, pfad, abfrage, bisher);
    if (!geholt.ok) return geholt;
    abzug[art] = geholt.wert;
    bisher += geholt.wert.length;
  }
  return { ok: true as const, wert: abzug };
};

/** Persons, absence types, attendance and absence periods; the token is revoked at the end */
export const personioAbrufen = async (
  deps: PersonioDeps,
  zugang: PersonioZugang,
  zeitraum: { von: Tag; bis: Tag },
): Promise<Ergebnis<PersonioAbzug>> => {
  const basis = { deps, nurOeffentlich: deps.basis === PERSONIO_API };
  const token = await tokenHolen(basis, zugang);
  if (!token.ok) return token;
  const k: Kontext = { ...basis, token: token.wert, frist: Date.now() + GESAMT_MS };
  const ergebnis = await listenHolen(k, zeitraum);
  // the token would hold for a day; whatever the answer, it ends with the fetch
  await senden(basis, "/v2/auth/revoke", { token: token.wert });
  return ergebnis;
};
