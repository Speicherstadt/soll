import {
  beginnInBerlin,
  buchungsMinuten,
  buchungZuordnen,
  plusTage,
  type Tag,
  tagInBerlin,
} from "@soll/arbeitszeit";
import { and, desc, eq, gt, isNull, lt, ne, or } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { projektzeiten } from "../../db/schema.ts";
import { type Stempel, stempelungenIn } from "../arbeitszeit/index.ts";

export type BuchungZeile = typeof projektzeiten.$inferSelect;

/**
 * A booking as the API shows it (S-602): its whole minutes (a running one up to now) and `kommen`,
 * the Kommen of the shift it falls in as the stamps stand now (its id and instant), or null. The rate it was billed with
 * is money and stays out (docs/plan.md, "Wer Stundensätze sieht").
 */
export type Buchung = Omit<BuchungZeile, "betriebId" | "centProStunde" | "angelegtAm"> & {
  minuten: number;
  kommen: { stempelId: string; zeitpunkt: number } | null;
};

/** The stamps in force around a working day: from two days before to two days after */
export const stempelUmfeld = (db: Db, betriebId: string, nutzerId: string, tag: Tag): Stempel[] =>
  stempelungenIn(
    db,
    betriebId,
    nutzerId,
    beginnInBerlin(plusTage(tag, -2)),
    beginnInBerlin(plusTage(tag, 2)),
  );

/** The stamps around the begin of a booking, enough to find the shift it falls in */
export const umfeldVon = (db: Db, betriebId: string, nutzerId: string, beginn: number) =>
  stempelUmfeld(db, betriebId, nutzerId, tagInBerlin(beginn));

export const alsBuchung = (
  { betriebId: _b, centProStunde: _c, angelegtAm: _a, ...zeile }: BuchungZeile,
  umfeld: readonly Stempel[],
  jetzt: number,
): Buchung => {
  const kommen = buchungZuordnen(umfeld, jetzt, zeile.beginn).kommen;
  return {
    ...zeile,
    minuten: buchungsMinuten(zeile.beginn, zeile.ende, jetzt),
    kommen: kommen ? { stempelId: kommen.stempelId, zeitpunkt: kommen.zeitpunkt } : null,
  };
};

/** One booking with its reference to the stamps, for the answer to a write */
export const buchungAnsicht = (db: Db, zeile: BuchungZeile, jetzt: number): Buchung =>
  alsBuchung(zeile, umfeldVon(db, zeile.betriebId, zeile.nutzerId, zeile.beginn), jetzt);

export const buchungLesen = (
  db: Db,
  betriebId: string,
  buchungId: string,
): BuchungZeile | undefined =>
  db
    .select()
    .from(projektzeiten)
    .where(and(eq(projektzeiten.betriebId, betriebId), eq(projektzeiten.buchungId, buchungId)))
    .get();

/** The person's running booking, if any (one at most: the partial unique index) */
export const laufendeVon = (
  db: Db,
  betriebId: string,
  nutzerId: string,
): BuchungZeile | undefined =>
  db
    .select()
    .from(projektzeiten)
    .where(
      and(
        eq(projektzeiten.betriebId, betriebId),
        eq(projektzeiten.nutzerId, nutzerId),
        isNull(projektzeiten.ende),
      ),
    )
    .get();

/** The bookings of a person on a working day, in time order */
export const buchungenAm = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  tag: Tag,
): BuchungZeile[] =>
  db
    .select()
    .from(projektzeiten)
    .where(
      and(
        eq(projektzeiten.betriebId, betriebId),
        eq(projektzeiten.nutzerId, nutzerId),
        eq(projektzeiten.tag, tag),
      ),
    )
    .orderBy(projektzeiten.beginn)
    .all();

/**
 * A booking of the person (other than `ausser`) that shares a minute with the span: it begins
 * before the span ends and ends (or runs) after the span begins
 */
export const ueberschneidende = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  spanne: { beginn: number; ende: number | null },
  ausser: string | null,
): BuchungZeile | undefined =>
  db
    .select()
    .from(projektzeiten)
    .where(
      and(
        eq(projektzeiten.betriebId, betriebId),
        eq(projektzeiten.nutzerId, nutzerId),
        ausser === null ? undefined : ne(projektzeiten.buchungId, ausser),
        spanne.ende === null ? undefined : lt(projektzeiten.beginn, spanne.ende),
        or(isNull(projektzeiten.ende), gt(projektzeiten.ende, spanne.beginn)),
      ),
    )
    .get();

export type Wahl = { projektId: string | null; taetigkeitId: string };

/** The orders and activities the person booked last, newest first, each once: one tap to switch */
export const zuletztVon = (db: Db, betriebId: string, nutzerId: string, anzahl = 6): Wahl[] => {
  const zeilen = db
    .select({ projektId: projektzeiten.projektId, taetigkeitId: projektzeiten.taetigkeitId })
    .from(projektzeiten)
    .where(and(eq(projektzeiten.betriebId, betriebId), eq(projektzeiten.nutzerId, nutzerId)))
    .orderBy(desc(projektzeiten.beginn))
    .limit(100)
    .all();
  const gesehen = new Set<string>();
  return zeilen
    .filter((wahl) => {
      const schluessel = JSON.stringify([wahl.projektId, wahl.taetigkeitId]);
      if (gesehen.has(schluessel)) return false;
      gesehen.add(schluessel);
      return true;
    })
    .slice(0, anzahl);
};
