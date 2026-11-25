import { type CsvZeile, csvZeilen, trennzeichenVon } from "./csv.ts";
import { kopfZuLang, MAX_SPALTEN, nurFehler } from "./kopf.ts";
import { type Gelesen, type ImportZeit, type LeseFehler, leer, MAX_DATENSAETZE } from "./modell.ts";
import type { Spaltenwahl } from "./soll-csv.ts";
import {
  TABELLE_FELDER,
  type TabelleFeld,
  type TabelleZeile,
  tabelleZeileLesen,
} from "./tabelle-zeile.ts";
import { bereinigt, ohneBom, schluessel, textAusBytes } from "./text.ts";
import { istZip, xlsxLesen } from "./xlsx.ts";

/*
 * Any spreadsheet of times (BAULISTE.md S-702): a CSV or the first sheet of an Excel workbook, its
 * first line the header, each further line a span of work of one person. Soll proposes the column
 * of each field from its header; the owner chooses each one in the mapping (`wahl`, "" for none),
 * and the server reads the file again with that choice.
 */

/** The headers each field is proposed from, German and English, compared by `schluessel` */
const KOPFWOERTER: Record<TabelleFeld, readonly string[]> = {
  kennung: ["kennung", "id", "externalid", "eintragsid", "buchungsid", "entryid"],
  person: ["person", "mitarbeiter", "mitarbeiterin", "mitarbeitende", "name", "employee", "user"],
  datum: ["datum", "date", "tag", "day", "arbeitstag", "workday"],
  beginn: ["beginn", "start", "kommen", "von", "from", "anfang", "arbeitsbeginn", "startzeit"],
  ende: ["ende", "end", "gehen", "bis", "to", "arbeitsende", "endzeit", "endtime"],
  dauer: ["dauer", "stunden", "arbeitszeit", "duration", "hours", "iststunden", "nettozeit"],
  pause: ["pause", "pausen", "break", "breaks", "pausenminuten", "pauseminuten"],
  projekt: ["projekt", "auftrag", "baustelle", "project", "job", "kostenstelle"],
  taetigkeit: ["taetigkeit", "tatigkeit", "leistung", "leistungsart", "activity", "task"],
};

/** A value longer than this is cut before it is cleaned: it is refused as too long anyway */
const MAX_ROH = 1000;

type Kopf = Partial<Record<TabelleFeld, number>>;

const kopfAus = (titel: string[], wahl: Spaltenwahl): Kopf => {
  const woerter = titel.map(schluessel);
  const kopf: Kopf = {};
  for (const feld of TABELLE_FELDER) {
    const gewaehlt = wahl[feld];
    const index =
      gewaehlt === undefined
        ? woerter.findIndex((wort) => KOPFWOERTER[feld].includes(wort))
        : gewaehlt === ""
          ? -1
          : titel.indexOf(bereinigt(gewaehlt));
    if (index >= 0) kopf[feld] = index;
  }
  return kopf;
};

/** The fields the owner chose a column for that the file does not have (review S-702) */
const nichtGefunden = (kopf: Kopf, wahl: Spaltenwahl): TabelleFeld[] =>
  TABELLE_FELDER.filter((feld) => (wahl[feld] ?? "") !== "" && kopf[feld] === undefined);

const zeileVon = (zeile: CsvZeile, kopf: Kopf, titel: string[]): TabelleZeile => {
  const werte = {} as Record<TabelleFeld, string>;
  const spalten: TabelleZeile["spalten"] = {};
  for (const feld of TABELLE_FELDER) {
    const index = kopf[feld];
    werte[feld] = bereinigt(
      (index === undefined ? "" : (zeile.felder[index] ?? "")).slice(0, MAX_ROH),
    );
    if (index !== undefined) spalten[feld] = titel[index] ?? "";
  }
  return { zeile: zeile.zeile, werte, spalten };
};

/**
 * The columns missing: those without which no line is a time (person, day, begin, and end or
 * duration), and every one the owner chose that the file does not have
 */
const fehlendeSpalten = (kopf: Kopf, wahl: Spaltenwahl): LeseFehler[] => {
  const noetig = (["person", "datum", "beginn", "ende"] as const).filter(
    (feld) => kopf[feld] === undefined && (feld !== "ende" || kopf.dauer === undefined),
  );
  const felder = new Set<TabelleFeld>([...noetig, ...nichtGefunden(kopf, wahl)]);
  return TABELLE_FELDER.filter((feld) => felder.has(feld)).map((feld) => ({
    zeile: 1,
    grund: "spalte_fehlt",
    feld,
  }));
};

const zeitenLesen = (zeilen: CsvZeile[], kopf: Kopf, titel: string[]) => {
  const daten = leer();
  const fehler: LeseFehler[] = [];
  const gesehen = new Set<string>();
  for (const roh of zeilen) {
    if (roh.offen) {
      fehler.push({ zeile: roh.zeile, grund: "unlesbar" });
      continue;
    }
    const zeit: ImportZeit | LeseFehler = tabelleZeileLesen(zeileVon(roh, kopf, titel));
    if ("grund" in zeit) fehler.push(zeit);
    else if (gesehen.has(zeit.externalId))
      fehler.push(
        kopf.kennung === undefined
          ? { zeile: zeit.zeile, grund: "zeile_doppelt" }
          : {
              zeile: zeit.zeile,
              grund: "kennung_doppelt",
              feld: "kennung",
              spalte: titel[kopf.kennung] ?? "",
              wert: zeit.externalId,
            },
      );
    else {
      gesehen.add(zeit.externalId);
      daten.zeiten.push(zeit);
    }
  }
  return { daten, fehler };
};

/** The lines of a file: an Excel workbook's first sheet, or a CSV; null when unreadable */
const zeilenAus = (bytes: Uint8Array): { zeilen: CsvZeile[]; zuViele: boolean } | null => {
  if (istZip(bytes)) {
    const mappe = xlsxLesen(bytes, MAX_DATENSAETZE + 1);
    return "fehler" in mappe ? null : mappe;
  }
  const text = ohneBom(textAusBytes(bytes));
  if (kopfZuLang(text)) return null;
  return { zeilen: csvZeilen(text, trennzeichenVon(text)), zuViele: false };
};

/** Reads a spreadsheet of times; `wahl` chooses the column of each field */
export const tabelleLesen = (bytes: Uint8Array, wahl: Spaltenwahl = {}): Gelesen => {
  const gelesen = zeilenAus(bytes);
  const [kopfzeile, ...zeilen] = gelesen?.zeilen ?? [];
  if (!kopfzeile || kopfzeile.offen || kopfzeile.felder.length > MAX_SPALTEN)
    return nurFehler([], { zeile: 1, grund: gelesen ? "kein_kopf" : "unlesbar" });
  const titel = kopfzeile.felder.map((feld) => bereinigt(feld.slice(0, MAX_ROH)));
  const kopf = kopfAus(titel, wahl);
  const spalten = Object.fromEntries(
    TABELLE_FELDER.map((feld) => [
      feld,
      kopf[feld] === undefined ? null : (titel[kopf[feld]] ?? null),
    ]),
  );
  const fehlend = fehlendeSpalten(kopf, wahl);
  if (fehlend.length > 0) return { daten: leer(), fehler: fehlend, kopf: titel, spalten };
  if (gelesen?.zuViele || zeilen.length > MAX_DATENSAETZE) {
    const zeile = (zeilen[MAX_DATENSAETZE] ?? zeilen.at(-1))?.zeile ?? 1;
    return { ...nurFehler(titel, { zeile, grund: "zu_viele" }), spalten };
  }
  return { ...zeitenLesen(zeilen, kopf, titel), kopf: titel, spalten };
};
