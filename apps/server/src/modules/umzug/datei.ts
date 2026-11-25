import type { Gelesen, Quelle, Spaltenwahl } from "@soll/import";

/*
 * The file of an import as it arrives (BAULISTE.md S-701): its bytes are what is kept under their
 * SHA-256; the text is read from them as UTF-8, or as Windows-1252 when they are none, as Excel in a
 * German locale saves a CSV.
 */

/** The largest file one import takes: 5 MiB */
export const MAX_BYTES = 5 * 1024 * 1024;

export const textVon = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
};

export const dateiLesen = (quelle: Quelle, bytes: Uint8Array, spalten: Spaltenwahl): Gelesen =>
  quelle.lesen(textVon(bytes), spalten);
