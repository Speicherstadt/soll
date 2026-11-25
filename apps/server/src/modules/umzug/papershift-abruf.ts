import type { Tag } from "@soll/arbeitszeit";
import { type PapershiftAntworten, papershiftAbzug, type SchichtplanerAbzug } from "@soll/import";
import {
  adresse,
  alleSeiten,
  type Ergebnis,
  kontextVon,
  listeUnter,
  SCHICHTPLANER_ADRESSEN,
  type SchichtplanerDeps,
  type Seite,
} from "./schichtplaner-abruf.ts";

/*
 * The fetch from Papershift's public API v1 (BAULISTE.md S-706). Sources, as
 * developers.papershift.com is not reachable: Papershift's own github.com/Papershift/
 * hosted_pages_template (src/api/index.js: `app.papershift.com/public_api/v1`, `api_token` as a
 * parameter, `/working_sessions` with `range_start`, `range_end`, `page`), github.com/
 * maluramichael/papershift-cli (`next_page` while there are more) and github.com/HelpCode-ai/
 * anythingmcp (adapters/de/papershift.json: 25 per page from 1, `interface_language` on every
 * request, the rows under the resource's name, `/users`, `/absences`, `/absence_types`). The token
 * goes in the query as Papershift demands; no error and no answer of Soll carries the address.
 * Papershift's shifts are not fetched (docs/plan.md, "Schichten aus Papershift").
 */

export type PapershiftZugang = { token: string };

/** A page of Papershift: the rows under the resource's name, `next_page` while more follow */
const seiteVon =
  (schluessel: string) =>
  (antwort: unknown): Seite | null => {
    const daten = listeUnter(antwort, schluessel);
    if (daten === null) return null;
    const weiter = (antwort as { next_page?: unknown }).next_page;
    return { daten, weiter: weiter !== null && weiter !== undefined && weiter !== false };
  };

/** The lists of a fetch: path, the key of its rows, whether it takes the period */
const LISTEN = [
  ["users", "/users", "users", false],
  ["absenceTypes", "/absence_types", "absence_types", false],
  ["workingSessions", "/working_sessions", "working_sessions", true],
  ["absences", "/absences", "absences", true],
] as const;

/** Users, absence types, the period's working sessions (until today) and absences */
export const papershiftAbrufen = async (
  deps: SchichtplanerDeps,
  zugang: PapershiftZugang,
  zeitraum: { von: Tag; bis: Tag; heute: Tag },
): Promise<Ergebnis<SchichtplanerAbzug>> => {
  const basis = deps.adressen.papershift;
  const k = kontextVon(deps, SCHICHTPLANER_ADRESSEN.papershift, basis, {});
  const antworten: Record<string, unknown[]> = {};
  let bisher = 0;
  for (const [art, pfad, schluessel, mitZeitraum] of LISTEN) {
    const ende =
      art === "workingSessions" && zeitraum.heute < zeitraum.bis ? zeitraum.heute : zeitraum.bis;
    const abfrage = {
      api_token: zugang.token,
      interface_language: "de",
      ...(mitZeitraum ? { range_start: zeitraum.von, range_end: ende } : {}),
    };
    const geholt = await alleSeiten(
      k,
      (n) => adresse(basis, pfad, { ...abfrage, page: n + 1 }),
      seiteVon(schluessel),
      bisher,
    );
    if (!geholt.ok) return geholt;
    antworten[art] = geholt.wert;
    bisher += geholt.wert.length;
  }
  const abzug = papershiftAbzug(antworten as unknown as PapershiftAntworten, {
    von: zeitraum.von,
    bis: zeitraum.bis,
  });
  return { ok: true, wert: abzug };
};
