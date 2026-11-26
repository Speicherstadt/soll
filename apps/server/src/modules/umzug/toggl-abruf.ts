import { plusTage, type Tag } from "@soll/arbeitszeit";
import { MAX_DATENSAETZE, type TogglAbzug } from "@soll/import";
import { type KimaiFehler, KOPFWERT, statusFehler } from "./kimai-abruf.ts";
import type { Holen } from "./kimai-holen.ts";

/*
 * Fetch from Toggl Track's API v9 (BAULISTE.md S-707, engineering.toggl.com):
 * GET /me, /me/clients, /me/projects, /me/tasks, /me/time_entries with Basic auth
 * `<token>:api_token`. Requests run sequentially; 403 means invalid token, 402 quota exceeded with
 * `X-Toggl-Quota-Resets-In`. Token is never stored, logged or returned.
 */

export const TOGGL_API = "https://api.track.toggl.com/api/v9";

export type TogglDeps = { holen: Holen; basis: string };
export type TogglZugang = { token: string };
export type TogglFehler = KimaiFehler;
type Ergebnis<T> = { ok: true; wert: T } | ({ ok: false } & TogglFehler);

const GESAMT_MS = 5 * 60_000;

const sekundenAus = (kopf: string | null): number | null => {
  const zahl = kopf === null ? Number.NaN : Number(kopf);
  return Number.isInteger(zahl) && zahl >= 0 ? zahl : null;
};

const fehlerAus = (status: number, kopf: (n: string) => string | null): TogglFehler | null => {
  if (status === 401 || status === 403) return { grund: "zugang_abgelehnt" };
  if (status === 402)
    return {
      grund: "zu_viele_anfragen",
      wiederholenNach: sekundenAus(kopf("x-toggl-quota-resets-in")),
    };
  return statusFehler({ status, kopf, text: "" });
};

const holen = async (
  deps: TogglDeps,
  kopf: Record<string, string>,
  pfad: string,
  frist: number,
): Promise<Ergebnis<unknown>> => {
  if (Date.now() > frist) return { ok: false, grund: "nicht_erreichbar" };
  const abgerufen = await deps.holen(
    new URL(`${deps.basis}${pfad}`),
    kopf,
    deps.basis === TOGGL_API,
  );
  if (!abgerufen.ok)
    return {
      ok: false,
      grund: abgerufen.grund === "zu_gross" ? "antwort_zu_gross" : abgerufen.grund,
    };
  const fehler = fehlerAus(abgerufen.wert.status, abgerufen.wert.kopf);
  if (fehler) return { ok: false, ...fehler };
  try {
    return { ok: true, wert: JSON.parse(abgerufen.wert.text) as unknown };
  } catch {
    return { ok: false, grund: "antwort_ungueltig" };
  }
};

const listeAus = (wert: unknown, bisher: number): Ergebnis<unknown[]> => {
  if (!Array.isArray(wert)) return { ok: false, grund: "antwort_ungueltig" };
  if (bisher + wert.length > MAX_DATENSAETZE) return { ok: false, grund: "zu_viele" };
  return { ok: true, wert };
};

export const togglAbrufen = async (
  deps: TogglDeps,
  zugang: TogglZugang,
  zeitraum: { von: Tag; bis: Tag },
): Promise<Ergebnis<TogglAbzug>> => {
  if (!KOPFWERT.test(zugang.token)) return { ok: false, grund: "zugang_ungueltig" };
  const kopf = {
    Accept: "application/json",
    "User-Agent": "Soll",
    Authorization: `Basic ${Buffer.from(`${zugang.token}:api_token`).toString("base64")}`,
  };
  const frist = Date.now() + GESAMT_MS;

  const ich = await holen(deps, kopf, "/me", frist);
  if (!ich.ok) return ich;
  if (typeof ich.wert !== "object" || ich.wert === null || Array.isArray(ich.wert))
    return { ok: false, grund: "antwort_ungueltig" };

  let bisher = 1;
  const kundenRes = await holen(deps, kopf, "/me/clients", frist);
  if (!kundenRes.ok) return kundenRes;
  const kunden = listeAus(kundenRes.wert, bisher);
  if (!kunden.ok) return kunden;
  bisher += kunden.wert.length;

  const projekteRes = await holen(deps, kopf, "/me/projects", frist);
  if (!projekteRes.ok) return projekteRes;
  const projekte = listeAus(projekteRes.wert, bisher);
  if (!projekte.ok) return projekte;
  bisher += projekte.wert.length;

  const aufgabenRes = await holen(deps, kopf, "/me/tasks", frist);
  if (!aufgabenRes.ok) return aufgabenRes;
  const aufgaben = listeAus(aufgabenRes.wert, bisher);
  if (!aufgaben.ok) return aufgaben;
  bisher += aufgaben.wert.length;

  const ende = plusTage(zeitraum.bis, 1);
  const eintraegeRes = await holen(
    deps,
    kopf,
    `/me/time_entries?start_date=${encodeURIComponent(zeitraum.von)}&end_date=${encodeURIComponent(ende)}`,
    frist,
  );
  if (!eintraegeRes.ok) return eintraegeRes;
  const eintraege = listeAus(eintraegeRes.wert, bisher);
  if (!eintraege.ok) return eintraege;

  return {
    ok: true,
    wert: {
      von: zeitraum.von,
      bis: zeitraum.bis,
      user: [ich.wert],
      client: kunden.wert,
      project: projekte.wert,
      task: aufgaben.wert,
      time_entry: eintraege.wert,
    },
  };
};
