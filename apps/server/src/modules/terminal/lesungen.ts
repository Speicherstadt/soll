import { and, eq, gt, min } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { kartenLesungen } from "../../db/schema.ts";
import type { Schreiber } from "../audit/index.ts";
import { karteLesen } from "./karten.ts";

/**
 * The read counters of an NTAG 424 DNA (S-802, S-803): online, a counter not above the highest one
 * seen was read before, a replay. An entry of the offline queue may bring a lower counter that was
 * read on the tablet before a later online read; it counts if that counter was never seen and the
 * entry's instant lies before the first read with a higher counter. A counter with no later read on
 * record (read before S-803) is not placed and stays a replay (docs/plan.md, "SUN-Nachricht aus der
 * Warteschlange").
 */

export type Lesung = { karteId: string; wert: number };

const gesehen = (db: Db, betriebId: string, lesung: Lesung): boolean =>
  db
    .select({ zaehler: kartenLesungen.zaehler })
    .from(kartenLesungen)
    .where(
      and(
        eq(kartenLesungen.betriebId, betriebId),
        eq(kartenLesungen.karteId, lesung.karteId),
        eq(kartenLesungen.zaehler, lesung.wert),
      ),
    )
    .get() !== undefined;

/** When the card was first read with a counter above this one, or null when no such read is known */
const naechsteLesung = (db: Db, betriebId: string, lesung: Lesung): number | null =>
  db
    .select({ am: min(kartenLesungen.gelesenAm) })
    .from(kartenLesungen)
    .where(
      and(
        eq(kartenLesungen.betriebId, betriebId),
        eq(kartenLesungen.karteId, lesung.karteId),
        gt(kartenLesungen.zaehler, lesung.wert),
      ),
    )
    .get()?.am ?? null;

/**
 * Whether a SUN message was read before: `offline` is the instant of an entry from the queue, absent
 * for a message read online
 */
export const wiederholt = (
  db: Db,
  betriebId: string,
  lesung: Lesung | undefined,
  offline?: number,
): boolean => {
  if (!lesung) return false;
  const zuletzt = karteLesen(db, betriebId, lesung.karteId)?.zaehler ?? null;
  if (zuletzt === null || lesung.wert > zuletzt) return false;
  if (offline === undefined || gesehen(db, betriebId, lesung)) return true;
  const spaeter = naechsteLesung(db, betriebId, lesung);
  return spaeter === null || offline > spaeter;
};

/** Takes a read over: the card's highest counter and the read itself, in the caller's transaction */
export const lesungMerken = (
  db: Db,
  s: Schreiber,
  betriebId: string,
  lesung: Lesung,
  gelesenAm: number,
): void => {
  const zuletzt = karteLesen(db, betriebId, lesung.karteId)?.zaehler ?? null;
  if (zuletzt === null || lesung.wert > zuletzt)
    s.aendern("karten", { karteId: lesung.karteId }, { zaehler: lesung.wert });
  s.einfuegen("kartenLesungen", {
    betriebId,
    karteId: lesung.karteId,
    zaehler: lesung.wert,
    gelesenAm,
  });
};
