import type { LeseFehler } from "../modell.ts";

/*
 * The records of a Kimai file as read, before they become the common model (BAULISTE.md S-705):
 * ids as text, instants as UTC milliseconds, each with its line.
 */

export type Benannt = { zeile: number; id: string; name: string; nummer: string };

export type Nutzer = { zeile: number; id: string; name: string };
export type Projekt = Benannt & { kunde: string };
/** An activity; `projekt` set for one of a single project, null for a global one */
export type Taetigkeit = Benannt & { projekt: string | null };

/** A timesheet: `ende` null while it runs; the break in whole seconds */
export type Zeitbuchung = {
  zeile: number;
  id: string;
  nutzer: string;
  beginn: number;
  ende: number | null;
  pauseSekunden: number;
  projekt: string | null;
  taetigkeit: string | null;
};

export type Bestand = {
  nutzer: Nutzer[];
  kunden: Benannt[];
  projekte: Projekt[];
  taetigkeiten: Taetigkeit[];
  zeitbuchungen: Zeitbuchung[];
  fehler: LeseFehler[];
};

export const leererBestand = (): Bestand => ({
  nutzer: [],
  kunden: [],
  projekte: [],
  taetigkeiten: [],
  zeitbuchungen: [],
  fehler: [],
});
