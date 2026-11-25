import { beginnInBerlin, plusTage, type Tag } from "@soll/arbeitszeit";
import { type CrewmeisterAntworten, crewmeisterAbzug, type SchichtplanerAbzug } from "@soll/import";
import {
  adresse,
  alleSeiten,
  type Ergebnis,
  jsonHolen,
  kontextVon,
  listeUnter,
  SCHICHTPLANER_ADRESSEN,
  type SchichtplanerDeps,
  type Seite,
  tokenAus,
} from "./schichtplaner-abruf.ts";

/*
 * The fetch from Crewmeister's API v3 (BAULISTE.md S-706). Sources, as crewmeister.com is not
 * reachable: github.com/mztechnik/hacs-crewmeister (api/client.py: `POST /api/v3/auth/user/` with
 * `username` and `password`, a JWT in `token`, sent as a bearer; `/api/v3/timetracking/stamps`,
 * `/api/v3/absencemanager/absences`) and github.com/HelpCode-ai/anythingmcp
 * (adapters/de/crewmeister.json: RSQL in `filter`, pages from 0 with `pageSize` up to 100, the page
 * as `content` with `hasNextPage`, the paths of members, absence type settings, shifts and
 * workplaces). E-mail and password go to Crewmeister for this one fetch and are kept nowhere.
 */

export type CrewmeisterZugang = { email: string; passwort: string };

const PAGE = 100;

/** A page of Crewmeister: `content` and `hasNextPage` */
const seite = (antwort: unknown): Seite | null => {
  const daten = listeUnter(antwort, "content");
  if (daten === null) return null;
  return { daten, weiter: (antwort as { hasNextPage?: unknown }).hasNextPage === true };
};

/** The instant a Berlin day begins, as RSQL takes it (ISO 8601 with an offset, here Z) */
const mitternacht = (tag: Tag) => new Date(beginnInBerlin(tag)).toISOString();

/** The lists of a fetch and their filters (RSQL; days `yyyy-MM-dd`); times only until today */
const LISTEN = (z: { von: Tag; bis: Tag; heute: Tag }) => {
  const zeitenBis = z.bis < z.heute ? z.bis : z.heute;
  return [
    ["members", "/api/v3/platform-app/members", ""],
    ["absenceTypes", "/api/v3/absencemanager/absence-type-settings", ""],
    ["workplaces", "/api/v3/shiftplanner/workplaces", ""],
    [
      "shifts",
      "/api/v3/shiftplanner/shifts",
      `from=ge=${mitternacht(z.von)};from=lt=${mitternacht(plusTage(z.bis, 1))}`,
    ],
    // a night shift's stamps after midnight belong to the day it began (`allocationDate`)
    [
      "stamps",
      "/api/v3/timetracking/stamps",
      `allocationDate=ge=${z.von};allocationDate=le=${zeitenBis}`,
    ],
    ["absences", "/api/v3/absencemanager/absences", `from=le=${z.bis};to=ge=${z.von}`],
  ] as const;
};

/** Members, absence types, workplaces, the period's shifts, stamps and absences */
export const crewmeisterAbrufen = async (
  deps: SchichtplanerDeps,
  zugang: CrewmeisterZugang,
  zeitraum: { von: Tag; bis: Tag; heute: Tag },
): Promise<Ergebnis<SchichtplanerAbzug>> => {
  const basis = deps.adressen.crewmeister;
  const echt = SCHICHTPLANER_ADRESSEN.crewmeister;
  const anmeldung = await jsonHolen(
    kontextVon(deps, echt, basis, {}),
    adresse(basis, "/api/v3/auth/user/", {}),
    {
      text: JSON.stringify({ username: zugang.email, password: zugang.passwort }),
      typ: "application/json",
    },
  );
  if (!anmeldung.ok) return anmeldung;
  const token = tokenAus(anmeldung.wert, "token");
  if (!token.ok) return token;
  const k = kontextVon(deps, echt, basis, { Authorization: `Bearer ${token.wert}` });
  const antworten: Record<string, unknown[]> = {};
  let bisher = 0;
  for (const [art, pfad, filter] of LISTEN(zeitraum)) {
    const geholt = await alleSeiten(
      k,
      (n) => adresse(basis, pfad, { ...(filter ? { filter } : {}), page: n, pageSize: PAGE }),
      seite,
      bisher,
    );
    if (!geholt.ok) return geholt;
    antworten[art] = geholt.wert;
    bisher += geholt.wert.length;
  }
  const abzug = crewmeisterAbzug(antworten as unknown as CrewmeisterAntworten, {
    von: zeitraum.von,
    bis: zeitraum.bis,
  });
  return { ok: true, wert: abzug };
};
