import { type CsvZeile, csvZeilen, trennzeichenVon } from "./csv.ts";
import { kopfZuLang, MAX_SPALTEN, nurFehler } from "./kopf.ts";
import { type Gelesen, type LeseFehler, leer, MAX_DATENSAETZE } from "./modell.ts";
import {
  artVon,
  datensatzLesen,
  type Felder,
  type Satz,
  SOLL_CSV_FELDER,
  type SollCsvFeld,
} from "./soll-csv-saetze.ts";
import { bereinigt, ohneBom, schluessel } from "./text.ts";

/*
 * The reference format of Soll's imports (BAULISTE.md S-701), with which the whole import is tested
 * from file to takeover: one CSV (RFC 4180, the separator found as for employees) whose column
 * `Typ` says what a line holds: a time, an absence, a customer or an order. The vendors' formats
 * (S-702 to S-707) read into the same model.
 */

export { SOLL_CSV_FELDER, type SollCsvFeld };

/** Which header a field is read from, as the mapping of columns names it */
export type Spaltenwahl = Partial<Record<string, string>>;

/** The headers each field is found under, German and English, compared by `schluessel` */
const KOPFWOERTER: Record<SollCsvFeld, readonly string[]> = {
  typ: ["typ", "type", "satzart"],
  kennung: ["kennung", "id", "externalid"],
  person: ["person", "mitarbeiter", "mitarbeiterin", "employee"],
  datum: ["datum", "date", "tag", "day"],
  beginn: ["beginn", "start", "kommen"],
  ende: ["ende", "end", "gehen"],
  pause: ["pause", "break", "pausenminuten"],
  bis: ["bis", "until"],
  art: ["art", "kind", "abwesenheitsart", "absencetype"],
  kunde: ["kunde", "customer"],
  name: ["name", "bezeichnung", "title"],
  nummer: ["nummer", "number", "nr"],
};

type Kopf = Partial<Record<SollCsvFeld, number>>;

const kopfAus = (felder: string[], wahl: Spaltenwahl): Kopf => {
  const woerter = felder.map(schluessel);
  const titel = felder.map(bereinigt);
  const kopf: Kopf = {};
  for (const feld of SOLL_CSV_FELDER) {
    const gewaehlt = wahl[feld];
    const index =
      gewaehlt === undefined
        ? woerter.findIndex((wort) => KOPFWOERTER[feld].includes(wort))
        : titel.indexOf(bereinigt(gewaehlt));
    if (index >= 0) kopf[feld] = index;
  }
  return kopf;
};

const felderVon = (zeile: CsvZeile, kopf: Kopf): Felder =>
  Object.fromEntries(
    SOLL_CSV_FELDER.map((feld) => {
      const index = kopf[feld];
      return [feld, bereinigt(index === undefined ? "" : (zeile.felder[index] ?? ""))];
    }),
  ) as Felder;

/**
 * Whether an earlier line of the same kind had this id, readable or not: the first line keeps it,
 * so mending the first line later never turns the second into a refusal
 */
const doppelt = (gesehen: Set<string>, felder: Felder): boolean => {
  const art = artVon(felder.typ);
  if (art === undefined || felder.kennung === "") return false;
  const schluesselVon = `${art}\u0000${felder.kennung}`;
  if (gesehen.has(schluesselVon)) return true;
  gesehen.add(schluesselVon);
  return false;
};

const satzVon = (zeile: CsvZeile, felder: Felder, gesehen: Set<string>): Satz | LeseFehler => {
  if (zeile.offen) return { zeile: zeile.zeile, grund: "unlesbar" };
  if (doppelt(gesehen, felder))
    return { zeile: zeile.zeile, grund: "kennung_doppelt", feld: "kennung", wert: felder.kennung };
  return datensatzLesen(zeile.zeile, felder);
};

/** Every line read: the records by kind and the lines refused */
const alleLesen = (zeilen: CsvZeile[], kopf: Kopf): Pick<Gelesen, "daten" | "fehler"> => {
  const daten = leer();
  const fehler: LeseFehler[] = [];
  const gesehen = new Set<string>();
  for (const zeile of zeilen) {
    const satz = satzVon(zeile, felderVon(zeile, kopf), gesehen);
    if ("grund" in satz) fehler.push(satz);
    else (daten[satz.art] as unknown[]).push(satz.wert);
  }
  // an order names a customer of the same file, wherever in the file it stands
  const kunden = new Set(daten.kunden.map((kunde) => kunde.externalId));
  const ohneKunde = daten.projekte.filter((projekt) => !kunden.has(projekt.kunde));
  daten.projekte = daten.projekte.filter((projekt) => kunden.has(projekt.kunde));
  for (const p of ohneKunde)
    fehler.push({ zeile: p.zeile, grund: "kunde_unbekannt", feld: "kunde", wert: p.kunde });
  fehler.sort((a, b) => a.zeile - b.zeile);
  return { daten, fehler };
};

const spaltenVon = (kopfzeile: string[], kopf: Kopf): Gelesen["spalten"] =>
  Object.fromEntries(
    SOLL_CSV_FELDER.map((feld) => {
      const index = kopf[feld];
      return [feld, index === undefined ? null : bereinigt(kopfzeile[index] ?? "")];
    }),
  );

/** Reads a Soll-CSV; `wahl` overrides the columns the header suggests */
export const sollCsvLesen = (roh: string, wahl: Spaltenwahl = {}): Gelesen => {
  const text = ohneBom(roh);
  if (kopfZuLang(text)) return nurFehler([], { zeile: 1, grund: "kein_kopf" });
  const [kopfzeile, ...zeilen] = csvZeilen(text, trennzeichenVon(text));
  if (!kopfzeile || kopfzeile.offen || kopfzeile.felder.length > MAX_SPALTEN)
    return nurFehler([], { zeile: 1, grund: "kein_kopf" });
  const titel = kopfzeile.felder.map(bereinigt);
  const kopf = kopfAus(kopfzeile.felder, wahl);
  if (kopf.typ === undefined || kopf.kennung === undefined)
    return nurFehler(titel, { zeile: 1, grund: "kein_kopf" });
  if (zeilen.length > MAX_DATENSAETZE) {
    const zuViel = zeilen[MAX_DATENSAETZE] as CsvZeile;
    return nurFehler(titel, { zeile: zuViel.zeile, grund: "zu_viele" });
  }
  return { ...alleLesen(zeilen, kopf), kopf: titel, spalten: spaltenVon(kopfzeile.felder, kopf) };
};
