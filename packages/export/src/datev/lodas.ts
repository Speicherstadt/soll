import type { Monat } from "@soll/arbeitszeit";
import type { Posten } from "./posten.ts";
import { betragText, datumText, stundenText } from "./zahlen.ts";

/*
 * The ASCII import file of DATEV LODAS for movement data (Bewegungsdaten). DATEV's interface manual
 * for LODAS (Schnittstellenhandbuch, DATEV Help-Center) was not reachable from the build environment;
 * developer.datev.de ("Lohnimportdatenservice", "Interface requirements ASCII-Format", hr:imports
 * 2.0.0, version 1.1 of 16.04.2025) was, and names the format but defers its fields to that manual.
 * The field rules below are therefore taken from public files that LODAS imports, each named at its
 * rule (docs/datev.md, "Quellen"):
 *
 * [A] JeffreyL26/admin, docs/datev-lohnexport.md, section 3.1, and apps/backend/src/modules/
 *     compensation/payrollExport/lodas.ts (citing "Schnittstellenhandbuch SSH LODAS, Fach 3 und 4")
 * [B] spaeth/docassemble-onboarding, docassemble/onboarding/data/templates/lodas.txt
 * [C] huskycare/odoo_german_wage_supplements, rcs_wage_type/models/hr_attendance_export.py
 * [D] replikativ/kontor, modules/payroll-de-datev/src/kontor/payroll_de_datev/emit.clj
 *
 * A test import at a tax office is one of the steps for people (BAULISTE.md).
 */

/** The record type number of the movement data, declared in [Satzbeschreibung] ([A], [B], [C]) */
const SATZ = 1;

/**
 * The table of LODAS for movement data of the current month ("Standard" in the entry tables, not the
 * recalculation `u_lod_bwd_buchung_nachber`) with its fields in the order the records give them:
 * month of payroll, personnel number, wage type, processing key (Bearbeitungsschlüssel) and the
 * value. Table and field names: [A] (same order), [B], [C].
 */
const SATZBESCHREIBUNG = [
  SATZ,
  "u_lod_bwd_buchung_standard",
  "abrechnung_zeitraum#bwd",
  "pnr#bwd",
  "la_eigene#bwd",
  "bs_nr#bwd",
  "bs_wert_butab#bwd",
];

/**
 * The processing key says what the value is: 1 hours, 2 an amount (gross). [A]: `LODAS_BS = {
 * stunden: 1, bruttobezug: 2, nettoabzug: 3 }`; [B]: "100,00;01;200" (hours) and "4500,00;02;100"
 * (an amount).
 */
const BS_STUNDEN = 1;
const BS_BETRAG = 2;

/** One record of the file: who, which wage type, what */
export type Zeile = { personalnummer: string; lohnart: string; posten: Posten };

export type LodasKopf = { beraterNr: string; mandantenNr: string; monat: Monat };

/**
 * [Allgemein]: target program, interface version, consultant and client number, field separator,
 * decimal comma and date format. Keys and values: [A] (all of them), [B] and [C] (Ziel, Version_SST,
 * BeraterNr, MandantenNr, Datumsformat), [D] (Feldtrennzeichen). No string delimiter: the file
 * holds no text.
 */
const allgemein = (kopf: LodasKopf): string[] => [
  "[Allgemein]",
  "Ziel=LODAS",
  "Version_SST=1.0",
  `BeraterNr=${kopf.beraterNr}`,
  `MandantenNr=${kopf.mandantenNr}`,
  "Feldtrennzeichen=;",
  "Zahlenkomma=,",
  "Datumsformat=TT.MM.JJJJ",
];

/** Every record, the description included, ends with the field separator ([A], [B], [C]) */
const satz = (felder: readonly (string | number)[]): string => `${felder.join(";")};`;

const bewegung = (abrechnungszeitraum: string, zeile: Zeile): string => {
  const { posten } = zeile;
  const [bs, wert] =
    "minuten" in posten
      ? [BS_STUNDEN, stundenText(posten.minuten)]
      : [BS_BETRAG, betragText(posten.cent)];
  return satz([SATZ, abrechnungszeitraum, zeile.personalnummer, zeile.lohnart, bs, wert]);
};

/**
 * The text of the file. The month of payroll is its first day ([A]: "01.10.2026", [B]:
 * "01/01/2021" with `Datumsformat=TT/MM/JJJJ`). Sections are parted by an empty line ([A]); every
 * line ends with CR LF (zeichensatz.ts), the last one too.
 */
export const lodasText = (kopf: LodasKopf, zeilen: readonly Zeile[]): string => {
  const zeitraum = datumText(`${kopf.monat}-01`);
  return [
    ...allgemein(kopf),
    "",
    "[Satzbeschreibung]",
    satz(SATZBESCHREIBUNG),
    "",
    "[Bewegungsdaten]",
    ...zeilen.map((zeile) => bewegung(zeitraum, zeile)),
  ]
    .map((zeile) => `${zeile}\r\n`)
    .join("");
};
