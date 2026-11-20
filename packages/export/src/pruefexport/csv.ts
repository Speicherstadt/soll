import { type CsvWert, csvDatei } from "../csv.ts";
import { datumText, zeitpunktText } from "../stundenzettel/format.ts";
import {
  aenderungText,
  befundText,
  beginnText,
  endeText,
  erfasstText,
  gegeneintragText,
} from "./texte.ts";
import type { Pruefexport, PruefPerson, PruefTag } from "./typen.ts";

/** The columns, one row per person and working day (docs/pruefexport.md) */
export const PRUEF_SPALTEN = [
  "Person",
  "Datum",
  "Beginn",
  "Ende",
  "Pausen (Minuten)",
  "Dauer (Minuten)",
  "Erfasst am",
  "Änderungen",
  "Gegeneinträge",
  "Befunde",
  "Monat abgeschlossen",
  "Prüfwert",
] as const;

/** Several entries in one cell, each on a line of its own */
const liste = (eintraege: readonly string[]) => eintraege.join("\n");

const zeile = (person: PruefPerson, tag: PruefTag): CsvWert[] => {
  const monat = person.monate.find((m) => m.monat === tag.tag.slice(0, 7));
  return [
    person.name,
    datumText(tag.tag),
    beginnText(tag),
    endeText(tag, false),
    tag.pauseMinuten,
    tag.arbeitsMinuten,
    erfasstText(tag),
    liste(tag.aenderungen.map((a) => aenderungText(a, tag.tag))),
    liste(tag.gegeneintraege.map(gegeneintragText)),
    liste(tag.befunde.map(befundText)),
    monat?.abgeschlossenAm == null ? "" : zeitpunktText(monat.abgeschlossenAm),
    monat?.pruefwert ?? "",
  ];
};

/** The Prüfexport as CSV: semicolons, UTF-8 with BOM, CRLF (docs/plan.md, "CSV der Exporte") */
export const pruefexportCsv = (daten: Pruefexport): string =>
  csvDatei([
    PRUEF_SPALTEN,
    ...daten.personen.flatMap((person) => person.tage.map((tag) => zeile(person, tag))),
  ]);
