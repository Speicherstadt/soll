import { plusTage } from "@soll/arbeitszeit";
import { kurzerText } from "../abzug-gemeinsam.ts";
import { type CsvZeile, csvZeilen, kopfZuLang, MAX_SPALTEN, trennzeichenVon } from "../csv.ts";
import { type LeseFehler, MAX_DATENSAETZE } from "../modell.ts";
import { bereinigt, ohneBom, schluessel } from "../text.ts";
import { type BerlinerUhr, berlinerUhr } from "../uhr.ts";
import type { Anbieter } from "./abzug-lesen.ts";
import type { Eintrag } from "./eintraege.ts";
import { berlinerZeitpunkt, datumLesen, uhrzeitLesen } from "./werte.ts";

/*
 * CSV reader for the Detailed report of Toggl Track (classic "User / Start date / Start time /
 * End date / End time" and newer "Member / Date / Start and stop time") and Clockify ("User /
 * Start Date / Start Time / End Date / End Time"). Columns are matched by header (BAULISTE.md S-707).
 */

type Spalte =
  | "person"
  | "kunde"
  | "projekt"
  | "aufgabe"
  | "startDatum"
  | "startZeit"
  | "endDatum"
  | "endZeit"
  | "datum"
  | "zeitspanne";

const KOPF_NAMEN: Record<Spalte, readonly string[]> = {
  person: ["user", "member"],
  kunde: ["client"],
  projekt: ["project"],
  aufgabe: ["task"],
  startDatum: ["start date"],
  startZeit: ["start time"],
  endDatum: ["end date"],
  endZeit: ["end time"],
  datum: ["date"],
  zeitspanne: ["start and stop time"],
};

type Kopf = Partial<Record<Spalte, number>>;
type Felder = Record<Spalte, string>;

const kopfAus = (titel: string[]): Kopf => {
  const woerter = titel.map(schluessel);
  const kopf: Kopf = {};
  for (const [spalte, namen] of Object.entries(KOPF_NAMEN) as [Spalte, readonly string[]][]) {
    const normal = namen.map(schluessel);
    const index = woerter.findIndex((w) => normal.includes(w));
    if (index >= 0) kopf[spalte] = index;
  }
  return kopf;
};

const kopfGueltig = (anbieter: Anbieter, k: Kopf): boolean => {
  if (k.person === undefined) return false;
  const klassisch =
    k.startDatum !== undefined &&
    k.startZeit !== undefined &&
    k.endDatum !== undefined &&
    k.endZeit !== undefined;
  if (anbieter === "clockify") return klassisch;
  const mitglied = k.datum !== undefined && k.zeitspanne !== undefined;
  return klassisch || mitglied;
};

const felderVon = (zeile: CsvZeile, kopf: Kopf): Felder =>
  Object.fromEntries(
    (Object.keys(KOPF_NAMEN) as Spalte[]).map((spalte) => {
      const index = kopf[spalte];
      return [spalte, index === undefined ? "" : bereinigt(zeile.felder[index] ?? "")];
    }),
  ) as Felder;

const textFeld = (wert: string, feld: string, zeile: number): string | LeseFehler => {
  if (wert === "") return "";
  const kurz = kurzerText(wert);
  return kurz === null ? { zeile, grund: "zu_lang", feld, wert } : kurz;
};

const spanneAusKlassisch = (
  zeile: number,
  f: Felder,
  uhr: BerlinerUhr,
): { beginn: number; ende: number } | LeseFehler => {
  const startTag = datumLesen(f.startDatum);
  if (startTag === null)
    return { zeile, grund: "datum_ungueltig", feld: "Start date", wert: f.startDatum };
  const startSek = uhrzeitLesen(f.startZeit);
  if (startSek === null)
    return { zeile, grund: "zeit_ungueltig", feld: "Start time", wert: f.startZeit };
  const endTag = datumLesen(f.endDatum);
  if (endTag === null)
    return { zeile, grund: "datum_ungueltig", feld: "End date", wert: f.endDatum };
  const endSek = uhrzeitLesen(f.endZeit);
  if (endSek === null) return { zeile, grund: "zeit_ungueltig", feld: "End time", wert: f.endZeit };
  const beginn = berlinerZeitpunkt(uhr, startTag, startSek);
  if (beginn === null)
    return { zeile, grund: "zeit_ungueltig", feld: "Start time", wert: f.startZeit };
  const ende = berlinerZeitpunkt(uhr, endTag, endSek);
  if (ende === null) return { zeile, grund: "zeit_ungueltig", feld: "End time", wert: f.endZeit };
  return { beginn, ende };
};

const spanneAusMitglied = (
  zeile: number,
  f: Felder,
  uhr: BerlinerUhr,
): { beginn: number; ende: number } | LeseFehler => {
  const startTag = datumLesen(f.datum);
  if (startTag === null) return { zeile, grund: "datum_ungueltig", feld: "Date", wert: f.datum };
  const teile = /^(.+?)\s*-\s*(.+)$/.exec(f.zeitspanne);
  if (!teile)
    return { zeile, grund: "zeit_ungueltig", feld: "Start and stop time", wert: f.zeitspanne };
  const startSek = uhrzeitLesen((teile[1] as string).trim());
  const endSek = uhrzeitLesen((teile[2] as string).trim());
  if (startSek === null || endSek === null)
    return { zeile, grund: "zeit_ungueltig", feld: "Start and stop time", wert: f.zeitspanne };
  const beginn = berlinerZeitpunkt(uhr, startTag, startSek);
  if (beginn === null)
    return { zeile, grund: "zeit_ungueltig", feld: "Start and stop time", wert: f.zeitspanne };
  const endTag = endSek <= startSek ? plusTage(startTag, 1) : startTag;
  const ende = berlinerZeitpunkt(uhr, endTag, endSek);
  if (ende === null)
    return { zeile, grund: "zeit_ungueltig", feld: "Start and stop time", wert: f.zeitspanne };
  return { beginn, ende };
};

const eintragLesen = (
  zeile: number,
  f: Felder,
  hatKlassisch: boolean,
  uhr: BerlinerUhr,
): Eintrag | LeseFehler => {
  const person = textFeld(f.person, "User", zeile);
  if (typeof person !== "string") return person;
  if (person === "") return { zeile, grund: "person_fehlt", feld: "User" };
  const kunde = textFeld(f.kunde, "Client", zeile);
  if (typeof kunde !== "string") return kunde;
  const projekt = textFeld(f.projekt, "Project", zeile);
  if (typeof projekt !== "string") return projekt;
  const aufgabe = textFeld(f.aufgabe, "Task", zeile);
  if (typeof aufgabe !== "string") return aufgabe;

  const spanne = hatKlassisch
    ? spanneAusKlassisch(zeile, f, uhr)
    : spanneAusMitglied(zeile, f, uhr);
  if ("grund" in spanne) return spanne;
  return {
    zeile,
    person,
    kunde,
    projekt,
    aufgabe,
    beginn: spanne.beginn,
    ende: spanne.ende,
  };
};

export const csvLesen = (
  anbieter: Anbieter,
  rohText: string,
  hoechstens = MAX_DATENSAETZE,
): { eintraege: Eintrag[]; fehler: LeseFehler[]; kopf: string[] } | { fehler: LeseFehler } => {
  const text = ohneBom(rohText);
  if (kopfZuLang(text)) return { fehler: { zeile: 1, grund: "kein_kopf" } };
  const trenner = trennzeichenVon(text);
  const zeilen = csvZeilen(text, trenner);
  const erste = zeilen[0];
  if (!erste || erste.offen || erste.felder.length > MAX_SPALTEN)
    return { fehler: { zeile: 1, grund: "kein_kopf" } };
  const kopf = kopfAus(erste.felder);
  if (!kopfGueltig(anbieter, kopf)) return { fehler: { zeile: 1, grund: "kein_kopf" } };
  if (zeilen.length - 1 > hoechstens)
    return { fehler: { zeile: hoechstens + 2, grund: "zu_viele" } };

  const hatKlassisch =
    kopf.startDatum !== undefined &&
    kopf.startZeit !== undefined &&
    kopf.endDatum !== undefined &&
    kopf.endZeit !== undefined;
  const uhr = berlinerUhr();
  const eintraege: Eintrag[] = [];
  const fehler: LeseFehler[] = [];

  for (const zeile of zeilen.slice(1)) {
    if (zeile.offen) {
      fehler.push({ zeile: zeile.zeile, grund: "unlesbar" });
      continue;
    }
    const felder = felderVon(zeile, kopf);
    const satz = eintragLesen(zeile.zeile, felder, hatKlassisch, uhr);
    if ("grund" in satz) fehler.push(satz);
    else eintraege.push(satz);
  }
  return { eintraege, fehler, kopf: erste.felder };
};
