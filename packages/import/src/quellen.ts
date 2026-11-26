import { clockodoLesen } from "./clockodo/index.ts";
import { kimaiLesen } from "./kimai/index.ts";
import type { Gelesen } from "./modell.ts";
import { personioLesen } from "./personio/index.ts";
import { schichtplanerLesen } from "./schichtplaner/index.ts";
import { type Spaltenwahl, sollCsvLesen } from "./soll-csv.ts";
import { tabelleLesen } from "./tabelle.ts";
import { ohneBom, textAusBytes } from "./text.ts";
import { WERKZEUGE, type Werkzeug } from "./werkzeuge.ts";
import { clockifyLesen, togglLesen } from "./zeiterfasser/index.ts";

/*
 * The tools Soll imports from (BAULISTE.md S-701) with their readers into the common model: each
 * reads the bytes of the file as uploaded, so a reader may take a workbook as well as a CSV (S-702).
 * A fetch over a tool's API becomes a file the same reader reads (S-703).
 */

export type Quelle = Werkzeug & { lesen: (bytes: Uint8Array, spalten: Spaltenwahl) => Gelesen };

/** The header of a Soll-CSV and a line of each kind, as the template to download */
export const SOLL_CSV_VORLAGE = [
  "Typ;Kennung;Person;Datum;Beginn;Ende;Pause;Bis;Art;Kunde;Name;Nummer",
  "zeit;z-1;Sandra Kühn;01.09.2026;7:00;15:30;30;;;;;",
  "abwesenheit;a-1;Sandra Kühn;07.09.2026;;;;11.09.2026;Urlaub;;;",
  "kunde;k-1;;;;;;;;;Elbhof Immobilien;K-1001",
  "projekt;p-1;;;;;;;;k-1;Bad Elbhof;A-17",
  "",
].join("\r\n");

/**
 * The balances on a cut-off date as a Soll-CSV of their own (S-708): the owner fills in what the
 * old tool showed on the first day of a month; overtime signed in hours and minutes, leave in days
 */
export const SOLL_SALDEN_VORLAGE = [
  "Typ;Kennung;Person;Datum;Überstunden;Resturlaub",
  "saldo;s-1;Sandra Kühn;01.10.2026;-3:15;8,5",
  "",
].join("\r\n");

const LESER: Record<string, Quelle["lesen"]> = {
  "soll-csv": (bytes, spalten) => sollCsvLesen(ohneBom(textAusBytes(bytes)), spalten),
  tabelle: tabelleLesen,
  clockodo: (bytes) => clockodoLesen(textAusBytes(bytes)),
  kimai: (bytes) => kimaiLesen(bytes),
  personio: (bytes) => personioLesen(bytes),
  papershift: schichtplanerLesen("papershift"),
  planday: schichtplanerLesen("planday"),
  crewmeister: schichtplanerLesen("crewmeister"),
  toggl: (bytes) => togglLesen(bytes),
  clockify: (bytes) => clockifyLesen(bytes),
};

export const QUELLEN: readonly Quelle[] = WERKZEUGE.map((werkzeug) => ({
  ...werkzeug,
  lesen: LESER[werkzeug.id] as Quelle["lesen"],
}));

export const quelleVon = (id: string): Quelle | undefined =>
  QUELLEN.find((quelle) => quelle.id === id);
