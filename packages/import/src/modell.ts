import type { Abwesenheitsart } from "@soll/arbeitszeit";

/*
 * The common model of every import (BAULISTE.md S-701): whatever tool a file or an API comes from,
 * its reader turns it into these records. Each carries its id in the old tool (`externalId`), so a
 * second import finds what the first took over, and the line it was read from, so a finding names
 * it. Times of day are whole minutes on a clock in Berlin, days `YYYY-MM-DD` (CLAUDE.md, "Time").
 */

/** A span of work of one person on one day: begin and end on the clock, the break in minutes */
export type ImportZeit = {
  externalId: string;
  zeile: number;
  /** the person as the old tool names it (its id or name); the mapping names the member */
  person: string;
  tag: string;
  /** minutes since midnight; an end at or before the begin lies on the next day */
  beginn: number;
  ende: number;
  pauseMinuten: number;
};

/** An absence from `von` to `bis`, both included; `art` as the old tool calls it */
export type ImportAbwesenheit = {
  externalId: string;
  zeile: number;
  person: string;
  art: string;
  von: string;
  bis: string;
};

export type ImportKunde = { externalId: string; zeile: number; name: string; nummer: string };

/** An order of a customer; `kunde` is the customer's id in the old tool */
export type ImportProjekt = {
  externalId: string;
  zeile: number;
  kunde: string;
  name: string;
  nummer: string;
};

export type ImportDaten = {
  zeiten: ImportZeit[];
  abwesenheiten: ImportAbwesenheit[];
  kunden: ImportKunde[];
  projekte: ImportProjekt[];
};

export const LESE_GRUENDE = [
  "kein_kopf",
  "zu_viele",
  "unlesbar",
  "typ_unbekannt",
  "kennung_fehlt",
  "kennung_doppelt",
  "person_fehlt",
  "name_fehlt",
  "zu_lang",
  "datum_ungueltig",
  "zeit_ungueltig",
  "pause_ungueltig",
  "art_fehlt",
  "kunde_unbekannt",
] as const;
export type LeseGrund = (typeof LESE_GRUENDE)[number];

/** Why a line could not be read; `feld` names the column, `wert` what it held */
export type LeseFehler = { zeile: number; grund: LeseGrund; feld?: string; wert?: string };

/** What a reader made of a file: the records, the lines it refused, the columns it found */
export type Gelesen = {
  daten: ImportDaten;
  fehler: LeseFehler[];
  /** the header of the file as written, for the mapping of columns */
  kopf: string[];
  /** which header each field was read from (null: not in the file) */
  spalten: Record<string, string | null>;
};

/** How an absence kind of the old tool is taken over: a kind of Soll or not at all */
export type ArtZuordnung = Abwesenheitsart | null;

/** The most records one import takes; a larger export is split by months */
export const MAX_DATENSAETZE = 20_000;
/** The longest text of a field (names, ids); longer ones are refused with their line */
export const MAX_TEXT = 100;

export const leer = (): ImportDaten => ({
  zeiten: [],
  abwesenheiten: [],
  kunden: [],
  projekte: [],
});
