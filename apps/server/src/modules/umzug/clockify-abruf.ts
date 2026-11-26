import { beginnInBerlin, plusTage, type Tag } from "@soll/arbeitszeit";
import { type ClockifyAbzug, MAX_DATENSAETZE } from "@soll/import";
import { type KimaiFehler, KOPFWERT, statusFehler } from "./kimai-abruf.ts";
import type { Holen } from "./kimai-holen.ts";

/*
 * Fetch from Clockify's API v1 (BAULISTE.md S-707, docs.clockify.me):
 * X-Api-Key header, GET /user, /workspaces/{ws}/clients, /projects, /projects/{id}/tasks,
 * /user/{userId}/time-entries with start/end/page/page-size and Last-Page header. Requests run
 * sequentially and only page as far as Last-Page indicates.
 */

export const CLOCKIFY_REGIONEN = {
  global: "https://api.clockify.me/api/v1",
  eu: "https://euc1.clockify.me/api/v1",
  usa: "https://use2.clockify.me/api/v1",
  uk: "https://euw2.clockify.me/api/v1",
  au: "https://apse2.clockify.me/api/v1",
} as const;

export type ClockifyRegion = keyof typeof CLOCKIFY_REGIONEN;
export type ClockifyDeps = { holen: Holen; basis: string | null };
export type ClockifyZugang = { schluessel: string; region: ClockifyRegion };
export type ClockifyFehler = KimaiFehler;
type Ergebnis<T> = { ok: true; wert: T } | ({ ok: false } & ClockifyFehler);

const GESAMT_MS = 5 * 60_000;
const SEITE = 200;

const holen = async (
  deps: ClockifyDeps,
  basis: string,
  nurOeffentlich: boolean,
  kopf: Record<string, string>,
  pfad: string,
  frist: number,
): Promise<Ergebnis<{ wert: unknown; letzteSeite: boolean }>> => {
  if (Date.now() > frist) return { ok: false, grund: "nicht_erreichbar" };
  const abgerufen = await deps.holen(new URL(`${basis}${pfad}`), kopf, nurOeffentlich);
  if (!abgerufen.ok)
    return {
      ok: false,
      grund: abgerufen.grund === "zu_gross" ? "antwort_zu_gross" : abgerufen.grund,
    };
  const fehler = statusFehler(abgerufen.wert);
  if (fehler) return { ok: false, ...fehler };
  try {
    const wert = JSON.parse(abgerufen.wert.text) as unknown;
    const letzteSeite = abgerufen.wert.kopf("last-page")?.toLowerCase() === "true";
    return { ok: true, wert: { wert, letzteSeite } };
  } catch {
    return { ok: false, grund: "antwort_ungueltig" };
  }
};

const alleSeiten = async (
  deps: ClockifyDeps,
  basis: string,
  nurOeffentlich: boolean,
  kopf: Record<string, string>,
  pfadMit: (seite: number) => string,
  bisher: number,
  frist: number,
): Promise<Ergebnis<unknown[]>> => {
  const saetze: unknown[] = [];
  for (let seite = 1; ; seite++) {
    const res = await holen(deps, basis, nurOeffentlich, kopf, pfadMit(seite), frist);
    if (!res.ok) return res;
    if (!Array.isArray(res.wert.wert)) return { ok: false, grund: "antwort_ungueltig" };
    saetze.push(...res.wert.wert);
    if (bisher + saetze.length > MAX_DATENSAETZE) return { ok: false, grund: "zu_viele" };
    if (res.wert.letzteSeite || res.wert.wert.length === 0) return { ok: true, wert: saetze };
  }
};

const isoUtc = (ms: number): string => new Date(ms).toISOString().replace(".000Z", "Z");

const aufgabenVon = async (
  deps: ClockifyDeps,
  basis: string,
  nurOeffentlich: boolean,
  kopf: Record<string, string>,
  ws: string,
  projekte: readonly unknown[],
  bisher: number,
  frist: number,
): Promise<Ergebnis<unknown[]>> => {
  const aufgaben: unknown[] = [];
  let summe = bisher;
  for (const p of projekte) {
    const pid =
      typeof p === "object" && p !== null && typeof (p as { id?: unknown }).id === "string"
        ? (p as { id: string }).id
        : null;
    if (!pid) continue;
    const teil = await alleSeiten(
      deps,
      basis,
      nurOeffentlich,
      kopf,
      (s) =>
        `/workspaces/${encodeURIComponent(ws)}/projects/${encodeURIComponent(pid)}/tasks?page=${s}&page-size=${SEITE}`,
      summe,
      frist,
    );
    if (!teil.ok) return teil;
    aufgaben.push(...teil.wert);
    summe += teil.wert.length;
  }
  return { ok: true, wert: aufgaben };
};

export const clockifyAbrufen = async (
  deps: ClockifyDeps,
  zugang: ClockifyZugang,
  zeitraum: { von: Tag; bis: Tag },
): Promise<Ergebnis<ClockifyAbzug>> => {
  if (!KOPFWERT.test(zugang.schluessel)) return { ok: false, grund: "zugang_ungueltig" };
  const echt = CLOCKIFY_REGIONEN[zugang.region];
  const basis = deps.basis ?? echt;
  const nurOeffentlich = basis === echt;
  const kopf = {
    Accept: "application/json",
    "User-Agent": "Soll",
    "X-Api-Key": zugang.schluessel,
  };
  const frist = Date.now() + GESAMT_MS;

  const nutzerRes = await holen(deps, basis, nurOeffentlich, kopf, "/user", frist);
  if (!nutzerRes.ok) return nutzerRes;
  const nutzer = nutzerRes.wert.wert;
  if (typeof nutzer !== "object" || nutzer === null || Array.isArray(nutzer))
    return { ok: false, grund: "antwort_ungueltig" };
  const n = nutzer as Record<string, unknown>;
  const userId = typeof n.id === "string" ? n.id : null;
  const ws =
    typeof n.activeWorkspace === "string" && n.activeWorkspace !== ""
      ? n.activeWorkspace
      : typeof n.defaultWorkspace === "string" && n.defaultWorkspace !== ""
        ? n.defaultWorkspace
        : null;
  if (!userId || !ws) return { ok: false, grund: "antwort_ungueltig" };

  let bisher = 1;
  const kunden = await alleSeiten(
    deps,
    basis,
    nurOeffentlich,
    kopf,
    (s) => `/workspaces/${encodeURIComponent(ws)}/clients?page=${s}&page-size=${SEITE}`,
    bisher,
    frist,
  );
  if (!kunden.ok) return kunden;
  bisher += kunden.wert.length;

  const projekte = await alleSeiten(
    deps,
    basis,
    nurOeffentlich,
    kopf,
    (s) => `/workspaces/${encodeURIComponent(ws)}/projects?page=${s}&page-size=${SEITE}`,
    bisher,
    frist,
  );
  if (!projekte.ok) return projekte;
  bisher += projekte.wert.length;

  const aufgaben = await aufgabenVon(
    deps,
    basis,
    nurOeffentlich,
    kopf,
    ws,
    projekte.wert,
    bisher,
    frist,
  );
  if (!aufgaben.ok) return aufgaben;
  bisher += aufgaben.wert.length;

  const start = isoUtc(beginnInBerlin(zeitraum.von));
  const end = isoUtc(beginnInBerlin(plusTage(zeitraum.bis, 1)));
  const eintraege = await alleSeiten(
    deps,
    basis,
    nurOeffentlich,
    kopf,
    (s) =>
      `/workspaces/${encodeURIComponent(ws)}/user/${encodeURIComponent(userId)}/time-entries?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&page=${s}&page-size=${SEITE}`,
    bisher,
    frist,
  );
  if (!eintraege.ok) return eintraege;

  return {
    ok: true,
    wert: {
      von: zeitraum.von,
      bis: zeitraum.bis,
      user: [nutzer],
      client: kunden.wert,
      project: projekte.wert,
      task: aufgaben.wert,
      time_entry: eintraege.wert,
    },
  };
};
