import type { Tag } from "@soll/arbeitszeit";
import {
  MAX_DATENSAETZE,
  type PlandayAntworten,
  plandayAbzug,
  type SchichtplanerAbzug,
} from "@soll/import";
import {
  adresse,
  alleSeiten,
  type Ergebnis,
  jsonHolen,
  type Kontext,
  kontextVon,
  listeUnter,
  SCHICHTPLANER_ADRESSEN,
  type SchichtplanerDeps,
  type Seite,
  tokenAus,
} from "./schichtplaner-abruf.ts";

/*
 * The fetch from Planday's Open API (BAULISTE.md S-706). Sources, as openapi.planday.com and
 * developer.planday.com are not reachable: github.com/borgels/mcp-server-planday (src/planday/
 * client.ts: the app's refresh token for an access token at `id.planday.com/connect/token`, a form
 * with `client_id`, `grant_type=refresh_token`, `refresh_token`; the app id in `X-ClientId`;
 * resources.ts: lists as `data` with `paging` `offset`, `limit` (at most 50), `total`) and
 * github.com/mindcloud-inc/universal-api-reference (apis/p/planday: the paths and their filters).
 * The breaks of a punch clock record come from `/punchclockshifts/{id}/breaks` (Planday's time clock
 * guide). App id and token go with this one fetch and are kept nowhere; should Planday hand out a
 * new refresh token, Soll does not keep it either.
 */

export type PlandayZugang = { appId: string; token: string };

const LIMIT = 50;

/** A page of Planday: `data` and `paging`; more follow while offset and count stay below total */
const seite = (antwort: unknown): Seite | null => {
  const daten = listeUnter(antwort, "data");
  if (daten === null) return null;
  const paging = (antwort as { paging?: { offset?: unknown; total?: unknown } }).paging;
  const offset = typeof paging?.offset === "number" ? paging.offset : 0;
  const total = typeof paging?.total === "number" ? paging.total : 0;
  return { daten, weiter: offset + daten.length < total };
};

/** The lists of a fetch; Planday's filters as its references name them (`From`, `startDate`) */
const LISTEN = (z: { von: Tag; bis: Tag; zeitenBis: Tag }) =>
  [
    ["employees", "/hr/v1.0/employees", {}, "offset"],
    // former employees, whose times and absences are in the period too
    ["deactivated", "/hr/v1.0/employees/deactivated", {}, "offset"],
    ["positions", "/scheduling/v1.0/positions", {}, "offset"],
    ["shifts", "/scheduling/v1.0/shifts", { From: z.von, To: z.bis }, "Offset"],
    ["punchClock", "/punchclock/v1.0/punchclockshifts", { from: z.von, to: z.zeitenBis }, "offset"],
    [
      "absenceRequests",
      "/absence/v1.0/absencerequests",
      { startDate: z.von, endDate: z.bis },
      "Offset",
    ],
  ] as const;

/** An access token for the app's refresh token, or why there is none */
const anmelden = async (deps: SchichtplanerDeps, zugang: PlandayZugang) => {
  const basis = deps.adressen.plandayId;
  const k = kontextVon(deps, SCHICHTPLANER_ADRESSEN.plandayId, basis, {});
  const form = new URLSearchParams({
    client_id: zugang.appId,
    grant_type: "refresh_token",
    refresh_token: zugang.token,
  });
  const antwort = await jsonHolen(k, adresse(basis, "/connect/token", {}), {
    text: form.toString(),
    typ: "application/x-www-form-urlencoded",
  });
  return antwort.ok ? tokenAus(antwort.wert, "access_token") : antwort;
};

/** The breaks of each finished punch clock record, one request per record */
const pausenHolen = async (
  k: Kontext,
  basis: string,
  saetze: readonly unknown[],
  bisher: number,
): Promise<Ergebnis<Record<string, unknown[]>>> => {
  const pausen: Record<string, unknown[]> = {};
  let zahl = bisher;
  for (const satz of saetze) {
    const r = (typeof satz === "object" && satz !== null ? satz : {}) as Record<string, unknown>;
    if (!Number.isSafeInteger(r.id) || r.endDateTime === null || r.endDateTime === undefined)
      continue;
    const geholt = await alleSeiten(
      k,
      () => adresse(basis, `/punchclock/v1.0/punchclockshifts/${r.id}/breaks`, {}),
      (antwort) => {
        const daten = listeUnter(antwort, "data");
        return daten === null ? null : { daten, weiter: false };
      },
      zahl,
    );
    if (!geholt.ok) return geholt;
    pausen[String(r.id)] = geholt.wert;
    zahl += geholt.wert.length;
  }
  return zahl > MAX_DATENSAETZE ? { ok: false, grund: "zu_viele" } : { ok: true, wert: pausen };
};

/** Employees (former ones too), positions, the period's shifts, punch clock with breaks, absences */
export const plandayAbrufen = async (
  deps: SchichtplanerDeps,
  zugang: PlandayZugang,
  zeitraum: { von: Tag; bis: Tag; heute: Tag },
): Promise<Ergebnis<SchichtplanerAbzug>> => {
  const token = await anmelden(deps, zugang);
  if (!token.ok) return token;
  const basis = deps.adressen.planday;
  const k = kontextVon(deps, SCHICHTPLANER_ADRESSEN.planday, basis, {
    Authorization: `Bearer ${token.wert}`,
    "X-ClientId": zugang.appId,
  });
  const zeitenBis = zeitraum.heute < zeitraum.bis ? zeitraum.heute : zeitraum.bis;
  const antworten: Record<string, unknown[]> = {};
  let bisher = 0;
  for (const [art, pfad, abfrage, versatz] of LISTEN({ ...zeitraum, zeitenBis })) {
    const geholt = await alleSeiten(
      k,
      (n) =>
        adresse(basis, pfad, {
          ...abfrage,
          [versatz]: n * LIMIT,
          [versatz === "Offset" ? "Limit" : "limit"]: LIMIT,
        }),
      seite,
      bisher,
    );
    if (!geholt.ok) return geholt;
    antworten[art] = geholt.wert;
    bisher += geholt.wert.length;
  }
  const breaks = await pausenHolen(k, basis, antworten.punchClock ?? [], bisher);
  if (!breaks.ok) return breaks;
  const { employees = [], deactivated = [], ...rest } = antworten;
  const abzug = plandayAbzug(
    {
      ...rest,
      employees: [...employees, ...deactivated],
      breaks: breaks.wert,
    } as unknown as PlandayAntworten,
    { von: zeitraum.von, bis: zeitraum.bis },
  );
  return { ok: true, wert: abzug };
};
