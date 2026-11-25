import { type Gelesen, type LeseFehler, leer } from "./modell.ts";

/*
 * The header of a table every reader shares (S-701, S-702): how long it may be, and the answer of a
 * reader that found nothing to read but one reason.
 */

/**
 * The most columns and characters a header may have: a Soll-CSV has twelve columns, an export a few
 * dozen. A longer first line is no header, refused before it is split, so a file of millions of
 * separators is read in time (BAULISTE.md S-701: no file hangs the reader).
 */
export const MAX_SPALTEN = 200;
const MAX_KOPFZEICHEN = 20_000;

export const kopfZuLang = (text: string): boolean => {
  const ende = text.indexOf("\n");
  return (ende === -1 ? text.length : ende) > MAX_KOPFZEICHEN;
};

export const nurFehler = (kopf: string[], fehler: LeseFehler): Gelesen => ({
  daten: leer(),
  fehler: [fehler],
  kopf,
  spalten: {},
});
