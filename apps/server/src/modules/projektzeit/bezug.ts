import { buchungZuordnen, LAENGSTE_SCHICHT } from "@soll/arbeitszeit";
import type { Db } from "../../db/oeffnen.ts";
import { umfeldVon } from "./buchungen-lesen.ts";
import type { Grund } from "./ergebnis.ts";
import { kundeLesen } from "./kunden.ts";
import { projektLesen } from "./projekte.ts";
import { taetigkeitLesen } from "./taetigkeiten.ts";

/** What a booking is on: an order of the business (none for internal time) and an activity */
export type Bezug = { projektId: string | null; taetigkeitId: string };

/**
 * Whether a new booking (or a change to what one is on) may name the order and activity: both known
 * to the business and not archived, an order of an archived customer counting as archived (S-601)
 */
export const bezugPruefen = (db: Db, betriebId: string, bezug: Bezug): Grund | null => {
  if (bezug.projektId !== null) {
    const projekt = projektLesen(db, betriebId, bezug.projektId);
    if (!projekt) return "projekt_unbekannt";
    const kunde = kundeLesen(db, betriebId, projekt.kundeId);
    if ((projekt.archiviertAm ?? kunde?.archiviertAm ?? null) !== null) return "archiviert";
  }
  const taetigkeit = taetigkeitLesen(db, betriebId, bezug.taetigkeitId);
  if (!taetigkeit) return "taetigkeit_unbekannt";
  return taetigkeit.archiviertAm === null ? null : "archiviert";
};

/**
 * A finished span: it ends after it begins, not after now, and lasts at most 24 hours (the longest
 * shift, LAENGSTE_SCHICHT): a longer one is a typing error, not a day's work
 */
export const spannePruefen = (beginn: number, ende: number, jetzt: number): Grund | null =>
  ende > beginn && ende <= jetzt && ende - beginn <= LAENGSTE_SCHICHT ? null : "spanne";

/** The working day a booking falls in, fixed when it is written (docs/plan.md, "Projektzeit") */
export const tagFuer = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  beginn: number,
  jetzt: number,
): string => buchungZuordnen(umfeldVon(db, betriebId, nutzerId, beginn), jetzt, beginn).tag;
