import type { LeseFehler } from "../modell.ts";

/*
 * What Soll reads of Clockodo, whichever way it came (BAULISTE.md S-703): the CSV backup of entries
 * or the records fetched from the API. Both readers fill this, `ausBestand` turns it into the
 * common model. Ids are Clockodo's own, as text, so a run over the file finds what a run over the
 * API took over. Field names follow the models of the public SDK `clockodo`
 * (https://github.com/peerigon/clockodo/tree/main/src/models), docs.clockodo.com being out of reach.
 */

export type Nutzer = { zeile: number; id: string; name: string };
/** A customer or a service (an activity in Soll) */
export type Stamm = { zeile: number; id: string; name: string; nummer: string };
export type ProjektStamm = Stamm & { kunde: string };

/** Entry types (SDK `EntryType`): 1 time, 2 lump sum value, 3 lump sum service */
export const ZEITEINTRAG = 1;

export type Eintrag = {
  zeile: number;
  id: string;
  nutzer: string;
  typ: number;
  /** instants in UTC milliseconds; `ende` null while the clock runs */
  beginn: number;
  ende: number | null;
  /** seconds the duration was corrected by (`offset`, "Correction of time in seconds") */
  korrektur: number;
};

/** Absence status (SDK `AbsenceStatus`): 0 reported, 1 approved, 2 declined, 3 and 4 cancelled */
export const GENEHMIGT = 1;
export const BEANTRAGT = 0;

export type Abwesenheit = {
  zeile: number;
  id: string;
  nutzer: string;
  von: string;
  bis: string;
  status: number;
  typ: number;
  /** working days (`count_days`), hours of overtime reduction (`count_hours`); null: none */
  tage: number | null;
  stunden: number | null;
};

export type Bestand = {
  nutzer: Nutzer[];
  kunden: Stamm[];
  projekte: ProjektStamm[];
  leistungen: Stamm[];
  eintraege: Eintrag[];
  abwesenheiten: Abwesenheit[];
  fehler: LeseFehler[];
};

export const leererBestand = (): Bestand => ({
  nutzer: [],
  kunden: [],
  projekte: [],
  leistungen: [],
  eintraege: [],
  abwesenheiten: [],
  fehler: [],
});

/**
 * The absence types of Clockodo by number (SDK `AbsenceType`), named as the SDK names them. Soll
 * proposes a kind for the first five (zuordnung.ts); the others the owner decides.
 */
export const ABWESENHEITSTYPEN: Record<number, string> = {
  1: "Regular holiday",
  2: "Special leave",
  3: "Reduction of overtime",
  4: "Sick day",
  5: "Sick day of child",
  6: "School / further education",
  7: "Maternity protection",
  8: "Home office",
  9: "Work out of office",
  10: "Special leave unpaid",
  11: "Sick day unpaid",
  12: "Sick day of child unpaid",
  13: "Quarantine",
  14: "Military service",
  15: "Sick with sickness benefit",
};

export const typName = (typ: number): string => ABWESENHEITSTYPEN[typ] ?? `Type ${typ}`;
