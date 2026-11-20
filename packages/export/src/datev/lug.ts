import type { Zeile } from "./lodas.ts";
import { betragText, stundenText } from "./zahlen.ts";

/*
 * The movement data file of DATEV Lohn und Gehalt. Lohn und Gehalt reads a column file through its
 * ASCII import assistant with a record description the payroll office sets up once; the DATEV
 * Lohnimportdatenservice requires the structure of the "Standard.ini" of Lohn und Gehalt
 * (developer.datev.de, hr:imports 2.0.0, "Interface requirements ASCII-Format": "When importing
 * transaction data into Lohn und Gehalt, the structure of the Standard.ini file must always be
 * adhered to"). That INI and DATEV's help on the assistant were not reachable from the build
 * environment, so the layout follows the eleven fields of JeffreyL26/admin, docs/datev-lohnexport.md,
 * sections 4.1 and 4.2 (docs/datev.md, "Quellen"):
 *
 *   1 Personalnummer · 2 Kalendertag · 3 Ausfallschlüssel · 4 Lohnartennummer · 5 Stundenanzahl ·
 *   6 Tagesanzahl · 7 Wert · 8 Abweichender Faktor · 9 Abweichende Lohnveränderung ·
 *   10 Kostenstellennummer · 11 Kostenträger
 *
 * Separator ";", record end CR LF, decimal comma, no header and no sections; every line carries all
 * eleven fields without a separator at its end (same source, "42;;;420;;;200,00;;;;").
 */

const FELDER = 11;
const PERSONALNUMMER = 0;
const LOHNART = 3;
const STUNDEN = 4;
const WERT = 6;

const zeileText = (zeile: Zeile): string => {
  const felder: string[] = Array.from({ length: FELDER }, () => "");
  felder[PERSONALNUMMER] = zeile.personalnummer;
  felder[LOHNART] = zeile.lohnart;
  const { posten } = zeile;
  if ("minuten" in posten) felder[STUNDEN] = stundenText(posten.minuten);
  else felder[WERT] = betragText(posten.cent);
  return felder.join(";");
};

/** The text of the file, each record ending with CR LF */
export const lugText = (zeilen: readonly Zeile[]): string =>
  zeilen.map((zeile) => `${zeileText(zeile)}\r\n`).join("");
