import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { type Bezug, bezugPruefen, spannePruefen, tagFuer } from "./bezug.ts";
import {
  type Buchung,
  type BuchungZeile,
  buchungAnsicht,
  buchungLesen,
  ueberschneidende,
} from "./buchungen-lesen.ts";
import { type Ergebnis, type Grund, gesetzt, nein, ok } from "./ergebnis.ts";
import { imNachweis } from "./nachweis-sperre.ts";

/** A booking by hand: a finished span on whole minutes of the person `nutzerId` */
export type NeueBuchung = Bezug & {
  nutzerId: string;
  beginn: number;
  ende: number;
  notiz?: string | undefined;
};

export type BuchungAenderung = {
  projektId?: string | null | undefined;
  taetigkeitId?: string | undefined;
  beginn?: number | undefined;
  ende?: number | undefined;
  notiz?: string | undefined;
};

export const buchungAnlegen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  neu: NeueBuchung,
): Ergebnis<Buchung> => {
  const { betriebId, jetzt } = kontext;
  const grund =
    spannePruefen(neu.beginn, neu.ende, jetzt) ??
    bezugPruefen(db, betriebId, neu) ??
    (ueberschneidende(db, betriebId, neu.nutzerId, neu, null) ? "ueberschneidung" : null);
  if (grund) return nein(grund);
  const zeile = schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("projektzeiten", {
      betriebId,
      buchungId: crypto.randomUUID(),
      nutzerId: neu.nutzerId,
      projektId: neu.projektId,
      taetigkeitId: neu.taetigkeitId,
      beginn: neu.beginn,
      ende: neu.ende,
      tag: tagFuer(db, betriebId, neu.nutzerId, neu.beginn, jetzt),
      notiz: neu.notiz ?? "",
      angelegtAm: jetzt,
    }),
  );
  return ok(buchungAnsicht(db, zeile, jetzt));
};

/**
 * A booking the caller may change: of the business, the caller's own or (for owner and planner)
 * anyone's, not yet billed and in no signed Stundennachweis (S-605). Someone else's reads as unknown.
 */
export const aenderbare = (
  db: Db,
  kontext: Kontext,
  buchungId: string,
  fuerAndere: boolean,
): Ergebnis<BuchungZeile> => {
  const zeile = buchungLesen(db, kontext.betriebId, buchungId);
  if (!zeile || (!fuerAndere && zeile.nutzerId !== kontext.akteur)) return nein("unbekannt");
  if (zeile.abgerechnetAm !== null) return nein("abgerechnet");
  return imNachweis(db, kontext.betriebId, buchungId) ? nein("unterschrieben") : ok(zeile);
};

/** Why a change is refused: the span, what it is on (only when that changes), an overlap */
const aenderungPruefen = (
  db: Db,
  kontext: Kontext,
  zeile: BuchungZeile,
  aenderung: BuchungAenderung,
): Grund | null => {
  const beginn = aenderung.beginn ?? zeile.beginn;
  if (zeile.ende === null && aenderung.ende !== undefined) return "laeuft";
  const ende = aenderung.ende ?? zeile.ende;
  const spanne =
    ende === null
      ? beginn <= kontext.jetzt
        ? null
        : "spanne"
      : spannePruefen(beginn, ende, kontext.jetzt);
  const bezug = {
    projektId: aenderung.projektId === undefined ? zeile.projektId : aenderung.projektId,
    taetigkeitId: aenderung.taetigkeitId ?? zeile.taetigkeitId,
  };
  // what a booking already names may be archived since; only a new order or activity is checked
  const bezugNeu = bezug.projektId !== zeile.projektId || bezug.taetigkeitId !== zeile.taetigkeitId;
  return (
    spanne ??
    (bezugNeu ? bezugPruefen(db, kontext.betriebId, bezug) : null) ??
    (ueberschneidende(db, kontext.betriebId, zeile.nutzerId, { beginn, ende }, zeile.buchungId)
      ? "ueberschneidung"
      : null)
  );
};

/**
 * Changes what a booking is on, its span or its note until it is billed; a running booking keeps
 * running (its end is the stop). A new begin moves the booking to the working day it falls in.
 */
export const buchungAendern = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  buchungId: string,
  aenderung: BuchungAenderung,
  fuerAndere: boolean,
): Ergebnis<Buchung> => {
  const vorhanden = aenderbare(db, kontext, buchungId, fuerAndere);
  if (!vorhanden.ok) return nein(vorhanden.grund);
  const zeile = vorhanden.wert;
  const grund = aenderungPruefen(db, kontext, zeile, aenderung);
  if (grund) return nein(grund);
  const tag =
    aenderung.beginn === undefined
      ? {}
      : { tag: tagFuer(db, kontext.betriebId, zeile.nutzerId, aenderung.beginn, kontext.jetzt) };
  const neu = schreiben(schreibDb, kontext, (s) =>
    s.aendern("projektzeiten", { buchungId }, { ...gesetzt(aenderung), ...tag }),
  );
  return ok(buchungAnsicht(db, neu, kontext.jetzt));
};

/** Removes a booking until it is billed; a running one too (the stopwatch then stands) */
export const buchungEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  buchungId: string,
  fuerAndere: boolean,
): Ergebnis<null> => {
  const vorhanden = aenderbare(db, kontext, buchungId, fuerAndere);
  if (!vorhanden.ok) return nein(vorhanden.grund);
  schreiben(schreibDb, kontext, (s) => s.loeschen("projektzeiten", { buchungId }));
  return ok(null);
};
