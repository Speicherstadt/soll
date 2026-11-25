import type { LeseFehler } from "../modell.ts";
import type { Ortszeit } from "./werte.ts";

/*
 * The records of a Personio file as read, before they become the common model (BAULISTE.md S-704):
 * ids as text, date-times as local wall clocks, each with its line.
 */

export type Person = { zeile: number; id: string; name: string };

/** An absence type; `stunden` for one Personio counts in hours (`unit` HOUR) */
export type Art = { zeile: number; id: string; name: string; stunden: boolean };

/** `start` and `end` of a period, `ende` null while it is open; `status` its approval, if any */
export type Anwesenheit = {
  zeile: number;
  id: string;
  person: string;
  arbeit: boolean;
  beginn: Ortszeit;
  ende: Ortszeit | null;
  status: string | null;
};

export type Haelfte = "FIRST_HALF" | "SECOND_HALF";

export type Abwesenheit = {
  zeile: number;
  id: string;
  person: string;
  art: string;
  beginn: Ortszeit;
  beginnHalb: Haelfte | null;
  ende: Ortszeit | null;
  endeHalb: Haelfte | null;
  status: string | null;
};

export type Bestand = {
  personen: Person[];
  arten: Art[];
  anwesenheiten: Anwesenheit[];
  abwesenheiten: Abwesenheit[];
  fehler: LeseFehler[];
};

export const leererBestand = (): Bestand => ({
  personen: [],
  arten: [],
  anwesenheiten: [],
  abwesenheiten: [],
  fehler: [],
});
