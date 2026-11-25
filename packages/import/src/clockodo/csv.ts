import { type CsvZeile, csvZeilen, kopfZuLang, MAX_SPALTEN, trennzeichenVon } from "../csv.ts";
import { type Gelesen, type LeseFehler, leer, MAX_DATENSAETZE } from "../modell.ts";
import { bereinigt, schluessel } from "../text.ts";
import { type Bestand, type Eintrag, leererBestand, type Stamm } from "./bestand.ts";
import { ausBestand } from "./gelesen.ts";
import { kennungVon, kurzerText, sekundenLesen, zeitpunktLesen } from "./werte.ts";

/*
 * Clockodo's CSV backup of entries (BAULISTE.md S-703): one line per entry in 27 columns, as the
 * SDK reads it in `parseEntryFromCsv`
 * (https://github.com/peerigon/clockodo/blob/main/src/models/entry.csv.ts, the headers in
 * entry.csv.test.ts). The columns are found by their header, so their order does not matter.
 * Users, customers, projects and services come from the ids and names each line carries.
 */

const SPALTEN = {
  id: "Id",
  nutzer: "Co-worker Id",
  nutzerName: "Co-worker",
  kunde: "Customer Id",
  kundeName: "Customer",
  projekt: "Project Id",
  projektName: "Project",
  leistung: "Service Id",
  leistungName: "Service",
  beginn: "Begin (UTC)",
  ende: "End (UTC)",
  korrektur: "Correction of time in seconds",
  pauschale: "Lump sum value",
  pauschalLeistung: "Lump sum service Id",
} as const;
type Spalte = keyof typeof SPALTEN;
/** Without these a file is no backup of entries */
const PFLICHT: readonly Spalte[] = ["id", "nutzer", "beginn", "ende"];

type Kopf = Partial<Record<Spalte, number>>;
type Felder = Record<Spalte, string>;

const kopfAus = (titel: string[]): Kopf => {
  const woerter = titel.map(schluessel);
  const kopf: Kopf = {};
  for (const [spalte, name] of Object.entries(SPALTEN) as [Spalte, string][]) {
    const index = woerter.indexOf(schluessel(name));
    if (index >= 0) kopf[spalte] = index;
  }
  return kopf;
};

const felderVon = (zeile: CsvZeile, kopf: Kopf): Felder =>
  Object.fromEntries(
    (Object.keys(SPALTEN) as Spalte[]).map((spalte) => {
      const index = kopf[spalte];
      return [spalte, index === undefined ? "" : bereinigt(zeile.felder[index] ?? "")];
    }),
  ) as Felder;

/** Entry types (SDK `parseEntryFromCsv`): a lump sum service, a lump sum value, or time */
const typVon = (felder: Felder): number =>
  felder.pauschalLeistung !== "" ? 3 : felder.pauschale !== "" ? 2 : 1;

const eintragLesen = (zeile: number, f: Felder): Eintrag | LeseFehler => {
  const id = kennungVon(f.id);
  if (id === null) return { zeile, grund: "kennung_fehlt", feld: SPALTEN.id, wert: f.id };
  const nutzer = kennungVon(f.nutzer);
  if (nutzer === null) return { zeile, grund: "person_fehlt", feld: SPALTEN.nutzer };
  const beginn = zeitpunktLesen(f.beginn);
  if (beginn === null)
    return { zeile, grund: "zeit_ungueltig", feld: SPALTEN.beginn, wert: f.beginn };
  const ende = f.ende === "" ? null : zeitpunktLesen(f.ende);
  if (ende === null && f.ende !== "")
    return { zeile, grund: "zeit_ungueltig", feld: SPALTEN.ende, wert: f.ende };
  const korrektur = sekundenLesen(f.korrektur);
  if (korrektur === null)
    return { zeile, grund: "korrektur", feld: SPALTEN.korrektur, wert: f.korrektur };
  return { zeile, id, nutzer, typ: typVon(f), beginn, ende, korrektur };
};

/** A user, customer, project or service the first time a line names it */
const merken = (
  liste: Map<string, Stamm & { kunde?: string }>,
  satz: Stamm & { kunde?: string },
) => {
  if (!liste.has(satz.id)) liste.set(satz.id, satz);
};

const stamm = (zeile: number, idText: string, nameText: string): Stamm | null => {
  const id = kennungVon(idText);
  if (id === null) return null;
  return { zeile, id, name: kurzerText(nameText) || `#${id}`, nummer: "" };
};

type Gesammelt = Record<
  "nutzer" | "kunden" | "projekte" | "leistungen",
  Map<string, Stamm & { kunde?: string }>
>;

const stammdatenMerken = (g: Gesammelt, zeile: number, f: Felder, typ: number) => {
  const nutzer = stamm(zeile, f.nutzer, f.nutzerName);
  if (nutzer) merken(g.nutzer, nutzer);
  const kunde = stamm(zeile, f.kunde, f.kundeName);
  if (kunde) merken(g.kunden, kunde);
  const projekt = stamm(zeile, f.projekt, f.projektName);
  if (projekt && kunde) merken(g.projekte, { ...projekt, kunde: kunde.id });
  const leistung = typ === 3 ? null : stamm(zeile, f.leistung, f.leistungName);
  if (leistung) merken(g.leistungen, leistung);
};

const bestandAus = (zeilen: CsvZeile[], kopf: Kopf): Bestand => {
  const bestand = leererBestand();
  const g: Gesammelt = {
    nutzer: new Map(),
    kunden: new Map(),
    projekte: new Map(),
    leistungen: new Map(),
  };
  for (const zeile of zeilen) {
    if (zeile.offen) {
      bestand.fehler.push({ zeile: zeile.zeile, grund: "unlesbar" });
      continue;
    }
    const felder = felderVon(zeile, kopf);
    const eintrag = eintragLesen(zeile.zeile, felder);
    if ("grund" in eintrag) bestand.fehler.push(eintrag);
    else {
      bestand.eintraege.push(eintrag);
      stammdatenMerken(g, zeile.zeile, felder, eintrag.typ);
    }
  }
  bestand.nutzer = [...g.nutzer.values()];
  bestand.kunden = [...g.kunden.values()];
  bestand.projekte = [...g.projekte.values()].map((p) => ({ ...p, kunde: p.kunde ?? "" }));
  bestand.leistungen = [...g.leistungen.values()];
  return bestand;
};

const nurFehler = (kopf: string[], fehler: LeseFehler): Gelesen => ({
  daten: leer(),
  fehler: [fehler],
  kopf,
  spalten: {},
});

/** Reads Clockodo's CSV backup of entries */
export const clockodoCsvLesen = (text: string): Gelesen => {
  if (kopfZuLang(text)) return nurFehler([], { zeile: 1, grund: "kein_kopf" });
  const [kopfzeile, ...zeilen] = csvZeilen(text, trennzeichenVon(text));
  if (!kopfzeile || kopfzeile.offen || kopfzeile.felder.length > MAX_SPALTEN)
    return nurFehler([], { zeile: 1, grund: "kein_kopf" });
  const titel = kopfzeile.felder.map(bereinigt);
  const kopf = kopfAus(titel);
  if (PFLICHT.some((spalte) => kopf[spalte] === undefined))
    return nurFehler(titel, { zeile: 1, grund: "kein_kopf" });
  if (zeilen.length > MAX_DATENSAETZE)
    return nurFehler(titel, {
      zeile: (zeilen[MAX_DATENSAETZE] as CsvZeile).zeile,
      grund: "zu_viele",
    });
  return ausBestand(bestandAus(zeilen, kopf), titel);
};
