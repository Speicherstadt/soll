import { clockodoLesen } from "./clockodo/index.ts";
import type { Gelesen } from "./modell.ts";
import { SOLL_CSV_FELDER, type Spaltenwahl, sollCsvLesen } from "./soll-csv.ts";

/*
 * The tools Soll imports from (BAULISTE.md S-701): each with its ways in (a file the owner exports,
 * an API with an access the owner enters for one fetch, S-703) and a reader into the common model;
 * a fetch becomes a file the same reader reads. The server
 * and the app share this list; the app has the instructions for the export as texts per id.
 */

export type Quelle = {
  /** stored as `extern_quelle` at every row taken over: lower case, digits, `.`, `_`, `-` */
  id: string;
  /** the tool's own name, the same in every language */
  name: string;
  wege: readonly ("datei" | "api")[];
  /** the fields of the file, for the mapping of columns; none: the reader knows its columns */
  felder: readonly string[];
  lesen: (text: string, spalten: Spaltenwahl) => Gelesen;
};

/** The header of a Soll-CSV and a line of each kind, as the template to download */
export const SOLL_CSV_VORLAGE = [
  "Typ;Kennung;Person;Datum;Beginn;Ende;Pause;Bis;Art;Kunde;Name;Nummer",
  "zeit;z-1;Sandra Kühn;01.09.2026;7:00;15:30;30;;;;;",
  "abwesenheit;a-1;Sandra Kühn;07.09.2026;;;;11.09.2026;Urlaub;;;",
  "kunde;k-1;;;;;;;;;Elbhof Immobilien;K-1001",
  "projekt;p-1;;;;;;;;k-1;Bad Elbhof;A-17",
  "",
].join("\r\n");

export const QUELLEN: readonly Quelle[] = [
  {
    id: "soll-csv",
    name: "Soll-CSV",
    wege: ["datei"],
    felder: SOLL_CSV_FELDER,
    lesen: sollCsvLesen,
  },
  {
    id: "clockodo",
    name: "Clockodo",
    wege: ["datei", "api"],
    felder: [],
    lesen: (text) => clockodoLesen(text),
  },
];

export const quelleVon = (id: string): Quelle | undefined =>
  QUELLEN.find((quelle) => quelle.id === id);
