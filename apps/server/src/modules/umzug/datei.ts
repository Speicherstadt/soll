import type { Gelesen, Quelle, Spaltenwahl } from "@soll/import";

/*
 * The file of an import as it arrives (BAULISTE.md S-701): its bytes are what is kept under their
 * SHA-256; the tool's reader takes the bytes, so it may read a CSV (UTF-8 or Windows-1252) as well
 * as an Excel workbook (S-702).
 */

/** The largest file one import takes: 5 MiB */
export const MAX_BYTES = 5 * 1024 * 1024;

export const dateiLesen = (quelle: Quelle, bytes: Uint8Array, spalten: Spaltenwahl): Gelesen =>
  quelle.lesen(bytes, spalten);
