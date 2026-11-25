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
  /** the order and the activity as the file names them (S-702), mapped to Soll's by the owner */
  projekt?: string;
  taetigkeit?: string;
};

/** An absence from `von` to `bis`, both included; `art` as the old tool calls it */
export type ImportAbwesenheit = {
  externalId: string;
  zeile: number;
  person: string;
  art: string;
  von: string;
  bis: string;
  /** the first or the last day only half (Personio, S-704); missing: whole days */
  ersterHalb?: boolean;
  letzterHalb?: boolean;
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

/** An activity of the old tool (S-705; Clockodo's services in S-703 take the same shape) */
export type ImportTaetigkeit = { externalId: string; zeile: number; name: string };

/**
 * A booking of project time the old tool keeps of its own (Kimai's timesheets, S-705): a piece of
 * work of a person from `beginn` to `ende` (UTC milliseconds on whole minutes) on a project and an
 * activity, both named by their ids in the same file; `tag` is the Berlin day of the piece's time,
 * `zeit` the id of that time (ImportZeit), so a time not taken over takes its bookings with it
 */
export type ImportBuchung = {
  externalId: string;
  zeile: number;
  zeit: string;
  person: string;
  tag: string;
  beginn: number;
  ende: number;
  projekt: string;
  taetigkeit: string;
};

/**
 * The balances of a person on a cut-off date (S-708): `stichtag` the first day of a month, overtime
 * in whole minutes (signed) and leave in half days (all leave open that day, its year's included),
 * at least one of the two; null where the old tool gave none
 */
export type ImportSaldo = {
  externalId: string;
  zeile: number;
  person: string;
  stichtag: string;
  ueberstundenMinuten: number | null;
  urlaubHalbtage: number | null;
};

/**
 * A planned shift of a shift planner (S-706): instants in UTC milliseconds on whole minutes, the
 * planned break in minutes, the role as the tool names it (position, workplace); `person` null for
 * a shift nobody is planned on
 */
export type ImportSchicht = {
  externalId: string;
  zeile: number;
  person: string | null;
  beginn: number;
  ende: number;
  pauseMinuten: number;
  rolle: string;
};

export type ImportDaten = {
  zeiten: ImportZeit[];
  abwesenheiten: ImportAbwesenheit[];
  kunden: ImportKunde[];
  projekte: ImportProjekt[];
  taetigkeiten: ImportTaetigkeit[];
  buchungen: ImportBuchung[];
  salden: ImportSaldo[];
  schichten: ImportSchicht[];
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
  "laeuft_noch",
  "korrektur",
  "teil_tag",
  "nicht_genehmigt",
  "spalte_fehlt",
  "zeile_doppelt",
  "dauer_ungueltig",
  "dauer_abweichend",
  "projekt_unbekannt",
  "taetigkeit_unbekannt",
  "stichtag_ungueltig",
  "saldo_ungueltig",
] as const;
export type LeseGrund = (typeof LESE_GRUENDE)[number];

/**
 * Why a line could not be read; `feld` names the field, `spalte` the header of its column as the
 * file writes it, `wert` what it held
 */
export type LeseFehler = {
  zeile: number;
  grund: LeseGrund;
  feld?: string;
  spalte?: string;
  wert?: string;
};

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
  taetigkeiten: [],
  buchungen: [],
  salden: [],
  schichten: [],
});
