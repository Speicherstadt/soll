/*
 * CSV as Excel in Germany opens it with a double click (docs/plan.md, "CSV der Exporte"): UTF-8 with
 * a byte order mark, semicolons, CRLF and quotes after RFC 4180. A text cell a spreadsheet would read
 * as a formula gets an apostrophe in front (OWASP, "CSV Injection").
 */

const TRENNER = ";";
const FORMEL = /^[=+\-@\t\r]/;
const QUOTEN = /[";\r\n]/;

export type CsvWert = string | number;

/** One cell: numbers as they are, text guarded against formulas and quoted where needed */
export const csvZelle = (wert: CsvWert): string => {
  if (typeof wert === "number") return String(wert);
  const sicher = FORMEL.test(wert) ? `'${wert}` : wert;
  return QUOTEN.test(sicher) ? `"${sicher.replaceAll('"', '""')}"` : sicher;
};

/** A whole file, each row ending in CRLF (RFC 4180, 2.1) */
export const csvDatei = (zeilen: readonly (readonly CsvWert[])[]): string =>
  `﻿${zeilen.map((zeile) => `${zeile.map(csvZelle).join(TRENNER)}\r\n`).join("")}`;
