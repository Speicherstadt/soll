import { aufMinute } from "@soll/arbeitszeit";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { type Kontext, type Schreiber, schreiben } from "../audit/index.ts";
import { type Bezug, bezugPruefen, tagFuer } from "./bezug.ts";
import {
  type Buchung,
  type BuchungZeile,
  buchungAnsicht,
  laufendeVon,
  ueberschneidende,
} from "./buchungen-lesen.ts";
import { type Ergebnis, nein, ok } from "./ergebnis.ts";

/**
 * The stopwatch (S-602): one running booking per person. Starting while one runs is the switch in
 * one tap: the running booking ends on the minute the next begins, in the same transaction, so
 * nothing is lost between them and nothing overlaps. Instants are taken to the start of their
 * minute; a booking stopped within its first minute has no minute and is removed.
 */

export type Gestartet = { laufend: Buchung; beendet: Buchung | null; neu: boolean };

/** Ends the running booking at `ende`, or removes it when it has not lasted a minute */
const beenden = (s: Schreiber, laufend: BuchungZeile, ende: number): BuchungZeile | null => {
  if (ende <= laufend.beginn) {
    s.loeschen("projektzeiten", { buchungId: laufend.buchungId });
    return null;
  }
  return s.aendern("projektzeiten", { buchungId: laufend.buchungId }, { ende });
};

const gleich = (laufend: BuchungZeile, bezug: Bezug) =>
  laufend.projektId === bezug.projektId && laufend.taetigkeitId === bezug.taetigkeitId;

export const stoppuhrStarten = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
  neu: Bezug & { notiz?: string | undefined },
): Ergebnis<Gestartet> => {
  const { betriebId, jetzt } = kontext;
  const grund = bezugPruefen(db, betriebId, neu);
  if (grund) return nein(grund);
  const laufend = laufendeVon(db, betriebId, nutzerId);
  if (laufend && gleich(laufend, neu))
    return ok({ laufend: buchungAnsicht(db, laufend, jetzt), beendet: null, neu: false });
  const beginn = aufMinute(jetzt);
  const spanne = { beginn, ende: null };
  if (ueberschneidende(db, betriebId, nutzerId, spanne, laufend?.buchungId ?? null))
    return nein("ueberschneidung");
  const tag = tagFuer(db, betriebId, nutzerId, beginn, jetzt);
  const [beendet, gestartet] = schreiben(schreibDb, kontext, (s) => [
    laufend ? beenden(s, laufend, beginn) : null,
    s.einfuegen("projektzeiten", {
      betriebId,
      buchungId: crypto.randomUUID(),
      nutzerId,
      projektId: neu.projektId,
      taetigkeitId: neu.taetigkeitId,
      beginn,
      ende: null,
      tag,
      notiz: neu.notiz ?? "",
      angelegtAm: jetzt,
    }),
  ]);
  return ok({
    laufend: buchungAnsicht(db, gestartet, jetzt),
    beendet: beendet ? buchungAnsicht(db, beendet, jetzt) : null,
    neu: true,
  });
};

/** Stops the person's stopwatch on the minute; null when the booking had no minute yet */
export const stoppuhrStoppen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
): Ergebnis<{ beendet: Buchung | null }> => {
  const laufend = laufendeVon(db, kontext.betriebId, nutzerId);
  if (!laufend) return nein("laeuft_nicht");
  const beendet = schreiben(schreibDb, kontext, (s) =>
    beenden(s, laufend, aufMinute(kontext.jetzt)),
  );
  return ok({ beendet: beendet ? buchungAnsicht(db, beendet, kontext.jetzt) : null });
};
