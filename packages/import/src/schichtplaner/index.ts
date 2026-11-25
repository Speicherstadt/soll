import { einmal, personen } from "../abzug-gemeinsam.ts";
import {
  type Gelesen,
  type ImportAbwesenheit,
  type ImportSchicht,
  type ImportZeit,
  type LeseFehler,
  leer,
  MAX_DATENSAETZE,
} from "../modell.ts";
import { MINUTE, spanneAlsZeit, zusammenfassen } from "../spanne.ts";
import { textAusBytes } from "../text.ts";
import { type BerlinerUhr, berlinerUhr } from "../uhr.ts";
import { type Abwesenheit, type Arbeit, abzugLesen, type Bestand, type Schicht } from "./lesen.ts";

/*
 * The shift planners Papershift, Planday and Crewmeister (BAULISTE.md S-706): the file a fetch
 * became (abzug.ts), read into the common model by one reader for all three. Pieces of work become
 * spans as for Clockodo, Kimai and Personio (spanne.ts); planned shifts stay instants; absences are
 * whole or half days.
 */

export {
  type AbwesenheitSatz,
  type ArbeitSatz,
  type PersonSatz,
  SCHICHTPLANER_FORMAT,
  type SchichtplanerAbzug,
  type SchichtplanerSatz,
  type SchichtSatz,
  schichtplanerAbzugText,
  type Zeitpunkt,
} from "./abzug.ts";

const nachZeile = (a: { zeile: number }, b: { zeile: number }) => a.zeile - b.zeile;

/** A piece on whole minutes, never shorter (begin down, end up), or why it is none */
const gerundet = (a: Arbeit): (Arbeit & { ende: number }) | LeseFehler => {
  if (a.ende === null) return { zeile: a.zeile, grund: "laeuft_noch", feld: "end" };
  const beginn = Math.floor(a.beginn / MINUTE) * MINUTE;
  const ende = Math.ceil(a.ende / MINUTE) * MINUTE;
  return ende > beginn
    ? { ...a, beginn, ende }
    : { zeile: a.zeile, grund: "zeit_ungueltig", feld: "end" };
};

/**
 * The spans of all pieces: a person's pieces that touch or overlap are one block, the gaps the
 * breaks as stamped; a block of a day outside the period was fetched as margin and is dropped
 */
const zeitenAus = (
  arbeit: readonly Arbeit[],
  person: (id: string) => string,
  kontext: { uhr: BerlinerUhr; von: string; bis: string },
): { zeiten: ImportZeit[]; fehler: LeseFehler[] } => {
  const fehler: LeseFehler[] = [];
  const jePerson = new Map<string, (Arbeit & { ende: number })[]>();
  for (const stueck of arbeit) {
    const rund = gerundet(stueck);
    if ("grund" in rund) fehler.push(rund);
    else jePerson.set(rund.person, [...(jePerson.get(rund.person) ?? []), rund]);
  }
  const zeiten: ImportZeit[] = [];
  const folge = (a: Arbeit, b: Arbeit) => a.beginn - b.beginn || (a.id < b.id ? -1 : 1);
  const felder = { beginn: "begin", ende: "end" };
  for (const [id, stuecke] of jePerson)
    for (const block of zusammenfassen(stuecke, folge)) {
      const zeit = spanneAlsZeit(block, person(id), kontext.uhr, felder);
      if ("grund" in zeit) fehler.push(zeit);
      else if (zeit.tag >= kontext.von && zeit.tag <= kontext.bis) zeiten.push(zeit);
    }
  return { zeiten: zeiten.sort(nachZeile), fehler };
};

/** A planned shift on whole minutes, never shorter, or why it is none */
const schichtAus = (s: Schicht, person: (id: string) => string): ImportSchicht | LeseFehler => {
  const beginn = Math.floor(s.beginn / MINUTE) * MINUTE;
  const ende = Math.ceil(s.ende / MINUTE) * MINUTE;
  if (ende <= beginn) return { zeile: s.zeile, grund: "zeit_ungueltig", feld: "end" };
  if (ende - beginn >= 24 * 60 * MINUTE)
    return { zeile: s.zeile, grund: "zeit_ungueltig", feld: "end" };
  if (s.pause * MINUTE >= ende - beginn)
    return { zeile: s.zeile, grund: "pause_ungueltig", feld: "break", wert: String(s.pause) };
  return {
    externalId: s.id,
    zeile: s.zeile,
    person: s.person === null ? null : person(s.person),
    beginn,
    ende,
    pauseMinuten: s.pause,
    rolle: s.rolle,
  };
};

/**
 * An absence that happened: approved, whole or half days. A requested one is named with its line,
 * a part of a day the halves cannot name too; from the afternoon to the morning of one day is no
 * time at all. Of a sickness only its kind comes (Art. 9 DSGVO): the file has nothing else.
 */
const abwesenheitAus = (
  a: Abwesenheit,
  person: (id: string) => string,
): ImportAbwesenheit | LeseFehler => {
  const { zeile } = a;
  if (!a.genehmigt) return { zeile, grund: "nicht_genehmigt", feld: "approved" };
  if (a.teilTag) return { zeile, grund: "teil_tag", feld: "part_day" };
  if (a.bis < a.von || (a.von === a.bis && a.ersterHalb && a.letzterHalb))
    return { zeile, grund: "datum_ungueltig", feld: "to", wert: a.bis };
  return {
    externalId: a.id,
    zeile,
    person: person(a.person),
    art: a.art,
    von: a.von,
    bis: a.bis,
    ...(a.ersterHalb ? { ersterHalb: true } : {}),
    ...(a.letzterHalb ? { letzterHalb: true } : {}),
  };
};

/** Records and refusals of a list, in the order of the file */
const getrennt = <T>(ergebnisse: readonly (T | LeseFehler)[], fehler: LeseFehler[]): T[] =>
  ergebnisse.flatMap((e) => {
    if (typeof e === "object" && e !== null && "grund" in e) {
      fehler.push(e as LeseFehler);
      return [];
    }
    return [e as T];
  });

const datenAus = (bestand: Bestand): Omit<Gelesen, "kopf" | "spalten"> => {
  const fehler = [...bestand.fehler];
  const person = personen(einmal(bestand.personen, fehler));
  const uhr = berlinerUhr();
  const zeiten = zeitenAus(einmal(bestand.arbeit, fehler), person, { uhr, ...bestand });
  fehler.push(...zeiten.fehler);
  const schichten = getrennt(
    einmal(bestand.schichten, fehler).map((s) => schichtAus(s, person)),
    fehler,
  );
  const abwesenheiten = getrennt(
    einmal(bestand.abwesenheiten, fehler).map((a) => abwesenheitAus(a, person)),
    fehler,
  );
  return {
    daten: { ...leer(), zeiten: zeiten.zeiten, schichten, abwesenheiten },
    fehler: fehler.sort(nachZeile),
  };
};

/** The reader of one of the three tools: a file of another tool is refused at its first line */
export const schichtplanerLesen =
  (werkzeug: string) =>
  (bytes: Uint8Array): Gelesen => {
    const gelesen = abzugLesen(textAusBytes(bytes), werkzeug, MAX_DATENSAETZE);
    if ("fehler" in gelesen)
      return { daten: leer(), fehler: [gelesen.fehler], kopf: [], spalten: {} };
    return { ...datenAus(gelesen.bestand), kopf: [], spalten: {} };
  };
