import {
  type ImportAbwesenheit,
  type ImportKunde,
  type ImportProjekt,
  type ImportZeit,
  type LeseFehler,
  MAX_TEXT,
} from "./modell.ts";
import { schluessel } from "./text.ts";
import { datumLesen, minutenLesen, uhrzeitLesen } from "./werte.ts";

/* One line of a Soll-CSV read into a record of the import model, or the first reason it cannot be */

/** The fields of a Soll-CSV, each found by its header (soll-csv.ts) */
export const SOLL_CSV_FELDER = [
  "typ",
  "kennung",
  "person",
  "datum",
  "beginn",
  "ende",
  "pause",
  "bis",
  "art",
  "kunde",
  "name",
  "nummer",
] as const;
export type SollCsvFeld = (typeof SOLL_CSV_FELDER)[number];

export type Felder = Record<SollCsvFeld, string>;

/** A record read and the list of the model it goes to */
export type Satz =
  | { art: "zeiten"; wert: ImportZeit }
  | { art: "abwesenheiten"; wert: ImportAbwesenheit }
  | { art: "kunden"; wert: ImportKunde }
  | { art: "projekte"; wert: ImportProjekt };

/** The words of the column `Typ`, German and English */
/** The kinds a Soll-CSV holds (activities and bookings come only from tools that keep them) */
type SollCsvArt = "zeiten" | "abwesenheiten" | "kunden" | "projekte";

const TYPEN: Record<string, SollCsvArt> = {
  zeit: "zeiten",
  arbeitszeit: "zeiten",
  time: "zeiten",
  abwesenheit: "abwesenheiten",
  absence: "abwesenheiten",
  kunde: "kunden",
  customer: "kunden",
  projekt: "projekte",
  auftrag: "projekte",
  project: "projekte",
  order: "projekte",
};

/** Why a field cannot be read; the line is added by the caller */
type Fehler = Omit<LeseFehler, "zeile">;

const istFehler = (wert: unknown): wert is Fehler =>
  typeof wert === "object" && wert !== null && "grund" in wert;

const text = (felder: Felder, feld: SollCsvFeld, fehlt: LeseFehler["grund"]): string | Fehler => {
  const wert = felder[feld];
  if (wert === "") return { grund: fehlt, feld };
  return wert.length > MAX_TEXT ? { grund: "zu_lang", feld } : wert;
};

const kurz = (felder: Felder, feld: SollCsvFeld): string | Fehler =>
  felder[feld].length > MAX_TEXT ? { grund: "zu_lang", feld } : felder[feld];

const datum = (felder: Felder, feld: "datum" | "bis"): string | Fehler =>
  datumLesen(felder[feld]) ?? { grund: "datum_ungueltig", feld, wert: felder[feld] };

const uhrzeit = (felder: Felder, feld: "beginn" | "ende"): number | Fehler =>
  uhrzeitLesen(felder[feld]) ?? { grund: "zeit_ungueltig", feld, wert: felder[feld] };

const MINUTEN_PRO_TAG = 24 * 60;

/** The break of a span, shorter than the span */
const pause = (felder: Felder, beginn: number, ende: number): number | Fehler => {
  const dauer = ende > beginn ? ende - beginn : ende + MINUTEN_PRO_TAG - beginn;
  const minuten = minutenLesen(felder.pause);
  return minuten === null || minuten >= dauer
    ? { grund: "pause_ungueltig", feld: "pause", wert: felder.pause }
    : minuten;
};

const zeitLesen = (externalId: string, zeile: number, felder: Felder): ImportZeit | Fehler => {
  const person = text(felder, "person", "person_fehlt");
  if (istFehler(person)) return person;
  const tag = datum(felder, "datum");
  if (istFehler(tag)) return tag;
  const beginn = uhrzeit(felder, "beginn");
  if (istFehler(beginn)) return beginn;
  const ende = uhrzeit(felder, "ende");
  if (istFehler(ende)) return ende;
  // an end at the begin is neither nothing nor a whole day: no tool writes a shift like that
  if (ende === beginn) return { grund: "zeit_ungueltig", feld: "ende", wert: felder.ende };
  const pauseMinuten = pause(felder, beginn, ende);
  if (istFehler(pauseMinuten)) return pauseMinuten;
  return { externalId, zeile, person, tag, beginn, ende, pauseMinuten };
};

const abwesenheitLesen = (
  externalId: string,
  zeile: number,
  felder: Felder,
): ImportAbwesenheit | Fehler => {
  const person = text(felder, "person", "person_fehlt");
  if (istFehler(person)) return person;
  const von = datum(felder, "datum");
  if (istFehler(von)) return von;
  const bis = felder.bis === "" ? von : datum(felder, "bis");
  if (istFehler(bis)) return bis;
  if (bis < von) return { grund: "datum_ungueltig", feld: "bis", wert: felder.bis };
  const art = text(felder, "art", "art_fehlt");
  if (istFehler(art)) return art;
  return { externalId, zeile, person, art, von, bis };
};

/** Name and number of a customer or an order */
const benannt = (felder: Felder): { name: string; nummer: string } | Fehler => {
  const name = text(felder, "name", "name_fehlt");
  if (istFehler(name)) return name;
  const nummer = kurz(felder, "nummer");
  return istFehler(nummer) ? nummer : { name, nummer };
};

const kundeLesen = (externalId: string, zeile: number, felder: Felder): ImportKunde | Fehler => {
  const teile = benannt(felder);
  return istFehler(teile) ? teile : { externalId, zeile, ...teile };
};

const projektLesen = (
  externalId: string,
  zeile: number,
  felder: Felder,
): ImportProjekt | Fehler => {
  const teile = benannt(felder);
  if (istFehler(teile)) return teile;
  const kunde = text(felder, "kunde", "kunde_unbekannt");
  return istFehler(kunde) ? kunde : { externalId, zeile, kunde, ...teile };
};

const LESER = {
  zeiten: zeitLesen,
  abwesenheiten: abwesenheitLesen,
  kunden: kundeLesen,
  projekte: projektLesen,
} as const;

/** The list of the model a line goes to by its column `Typ`, or undefined */
export const artVon = (typ: string): SollCsvArt | undefined => TYPEN[schluessel(typ)];

/** One line as a record of its kind, or the first reason it cannot be read */
export const datensatzLesen = (zeile: number, felder: Felder): Satz | LeseFehler => {
  const art = artVon(felder.typ);
  if (!art) return { zeile, grund: "typ_unbekannt", feld: "typ", wert: felder.typ };
  const id = text(felder, "kennung", "kennung_fehlt");
  if (istFehler(id)) return { zeile, ...id };
  const wert = LESER[art](id, zeile, felder);
  return istFehler(wert) ? { zeile, ...wert } : ({ art, wert } as Satz);
};
