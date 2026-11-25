import { xlsxSchreiben, type Zelle } from "./xlsx-schreiben.ts";

/*
 * The template of a spreadsheet of times (BAULISTE.md S-702), as CSV and as Excel workbook: the
 * header with the fields of the mapping and one line as an example. Pure and the same on every call,
 * so the file to download never changes unless this code does.
 */

/** The header of the template; the reader proposes each column from these words */
const KOPF = ["Person", "Datum", "Beginn", "Ende", "Pause", "Projekt", "Tätigkeit"];

/** Sandra on 1 September 2026, 7:00 to 15:30 with a break of 30 minutes, fitting at Bad Elbhof */
const BEISPIEL = {
  person: "Sandra Kühn",
  tag: "2026-09-01",
  beginn: 7 * 60,
  ende: 15 * 60 + 30,
  pause: 30,
  projekt: "Bad Elbhof",
  taetigkeit: "Montage",
};

/** The CSV template: semicolons, a German date, CRLF, with a byte order mark for Excel */
export const TABELLE_VORLAGE_CSV = `﻿${[
  KOPF.join(";"),
  `${BEISPIEL.person};01.09.2026;7:00;15:30;${BEISPIEL.pause};${BEISPIEL.projekt};${BEISPIEL.taetigkeit}`,
  "",
].join("\r\n")}`;

const ZEILEN: readonly (readonly Zelle[])[] = [
  KOPF.map((text) => ({ text })),
  [
    { text: BEISPIEL.person },
    { tag: BEISPIEL.tag },
    { minuten: BEISPIEL.beginn },
    { minuten: BEISPIEL.ende },
    { zahl: BEISPIEL.pause },
    { text: BEISPIEL.projekt },
    { text: BEISPIEL.taetigkeit },
  ],
];

/** The Excel template, made anew on each call (the bytes are the same) */
export const tabelleVorlageXlsx = (): Uint8Array => xlsxSchreiben("Zeiten", ZEILEN);
