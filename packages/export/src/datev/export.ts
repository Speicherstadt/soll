import type { Monat } from "@soll/arbeitszeit";
import { lodasText, type Zeile } from "./lodas.ts";
import { type LohnmonatEingabe, type Lohnproblem, lohnmonat } from "./lohnmonat.ts";
import { lugText } from "./lug.ts";
import type { Lohnarten, Lohnmonat, Postenart } from "./posten.ts";
import { windows1252 } from "./zeichensatz.ts";

/*
 * The DATEV payroll export of a month (S-308): the closed months of a business with its mapping
 * become one file for LODAS or for Lohn und Gehalt, or the list of what is "nicht hinterlegt".
 */

export type DatevZiel = "lodas" | "lug";

/**
 * The forms the numbers take (JeffreyL26/admin, docs/datev-lohnexport.md, section 1: consultant
 * number 4 to 7 digits, client number 1 to 5, the LODAS personnel number 1 to 5 digits; section 4.2:
 * the personnel number of Lohn und Gehalt in digits). Wage types of LODAS and Lohn und Gehalt have up
 * to four digits (same source, `la_eigene`; the wage type lists of the payroll office decide which).
 */
export const DATEV_FORMAT = {
  beraterNr: /^[0-9]{4,7}$/,
  mandantenNr: /^[0-9]{1,5}$/,
  personalnummer: /^[0-9]{1,5}$/,
  lohnart: /^[0-9]{1,4}$/,
} as const;

/** What a business set up with its payroll office */
export type DatevEinstellungen = {
  beraterNr: string | null;
  mandantenNr: string | null;
  lohnarten: Lohnarten;
  /** personnel number per person (`nutzer_id`) */
  personalnummern: Readonly<Record<string, string>>;
};

/** What keeps the export from being written */
export type Fehlend =
  | { art: "beraternummer" | "mandantennummer" }
  | { art: "personalnummer" | "monat_offen"; nutzerId: string }
  | { art: "lohnart"; posten: Postenart }
  | Lohnproblem;

export type DatevDatei = { dateiname: string; text: string; bytes: Uint8Array<ArrayBuffer> };

export type DatevExportErgebnis =
  | { ok: true; datei: DatevDatei }
  | { ok: false; fehlend: Fehlend[] };

export type DatevExportEingabe = {
  ziel: DatevZiel;
  monat: Monat;
  einstellungen: DatevEinstellungen;
  /** the closed months of the persons, as `lohnmonat` takes them */
  monate: readonly LohnmonatEingabe[];
  /** persons whose month is not closed: their numbers could still change (S-306) */
  offen: readonly string[];
};

const passt = (wert: string | null | undefined, format: RegExp): wert is string =>
  typeof wert === "string" && format.test(wert);

/** Consultant and client number: only the header of the LODAS file names them */
const kopfFehlt = (eingabe: DatevExportEingabe): Fehlend[] => {
  if (eingabe.ziel !== "lodas") return [];
  const { beraterNr, mandantenNr } = eingabe.einstellungen;
  return [
    ...(passt(beraterNr, DATEV_FORMAT.beraterNr) ? [] : [{ art: "beraternummer" } as const]),
    ...(passt(mandantenNr, DATEV_FORMAT.mandantenNr) ? [] : [{ art: "mandantennummer" } as const]),
  ];
};

/** Personnel numbers and wage types the months need and the mapping lacks */
const zuordnungFehlt = (monate: readonly Lohnmonat[], einstellungen: DatevEinstellungen) => {
  // a person without an item has no record, so needs no number
  const personen: Fehlend[] = monate
    .filter((m) => m.posten.length > 0)
    .filter((m) => !passt(einstellungen.personalnummern[m.nutzerId], DATEV_FORMAT.personalnummer))
    .map((m) => ({ art: "personalnummer", nutzerId: m.nutzerId }));
  const arten = new Set(monate.flatMap((m) => m.posten.map((p) => p.art)));
  const lohnarten: Fehlend[] = [...arten]
    .filter((art) => !passt(einstellungen.lohnarten[art], DATEV_FORMAT.lohnart))
    .map((posten) => ({ art: "lohnart", posten }));
  return [...personen, ...lohnarten];
};

/** The records in the order of the personnel numbers, each person's items in a fixed order */
const zeilenVon = (monate: readonly Lohnmonat[], einstellungen: DatevEinstellungen): Zeile[] =>
  monate
    .map((m) => ({ m, personalnummer: einstellungen.personalnummern[m.nutzerId] ?? "" }))
    .sort((a, b) => Number(a.personalnummer) - Number(b.personalnummer))
    .flatMap(({ m, personalnummer }) =>
      m.posten.map((posten) => ({
        personalnummer,
        lohnart: einstellungen.lohnarten[posten.art] ?? "",
        posten,
      })),
    );

const dateiVon = (eingabe: DatevExportEingabe, zeilen: readonly Zeile[]): DatevDatei => {
  const { ziel, monat, einstellungen } = eingabe;
  const text =
    ziel === "lodas"
      ? lodasText(
          {
            beraterNr: einstellungen.beraterNr ?? "",
            mandantenNr: einstellungen.mandantenNr ?? "",
            monat,
          },
          zeilen,
        )
      : lugText(zeilen);
  const dateiname = `DATEV_${ziel === "lodas" ? "LODAS" : "LuG"}_${monat}.txt`;
  return { dateiname, text, bytes: windows1252(text) };
};

/**
 * The file of a month, or everything that is missing at once: a month not closed, consultant and
 * client number (LODAS), a personnel number, a wage type of an item that occurs, and what the months
 * themselves lack (a model, a wage, holidays). Nothing is guessed (CLAUDE.md, "Never").
 */
export const datevExport = (eingabe: DatevExportEingabe): DatevExportErgebnis => {
  const ergebnisse = eingabe.monate.map(lohnmonat);
  const monate = ergebnisse.flatMap((e) => (e.ok ? [e.wert] : []));
  const fehlend: Fehlend[] = [
    ...eingabe.offen.map((nutzerId) => ({ art: "monat_offen", nutzerId }) as const),
    ...kopfFehlt(eingabe),
    ...ergebnisse.flatMap((e) => (e.ok ? [] : e.probleme)),
    ...zuordnungFehlt(monate, eingabe.einstellungen),
  ];
  if (fehlend.length > 0) return { ok: false, fehlend };
  return { ok: true, datei: dateiVon(eingabe, zeilenVon(monate, eingabe.einstellungen)) };
};
