import { and, asc, eq, gte, lt } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { einsaetze } from "../../db/schema.ts";

/* Reading a person's call-outs (S-505), for the month, the lock of a closed month and the plan */

export type Einsatz = typeof einsaetze.$inferSelect;

/** A person's call-outs in force (not removed) that begin from `von` to before `bis` */
export const einsaetzeIn = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  von: number,
  bis: number,
): Einsatz[] =>
  db
    .select()
    .from(einsaetze)
    .where(
      and(
        eq(einsaetze.betriebId, betriebId),
        eq(einsaetze.nutzerId, nutzerId),
        eq(einsaetze.entfernt, false),
        gte(einsaetze.beginn, von),
        lt(einsaetze.beginn, bis),
      ),
    )
    .orderBy(asc(einsaetze.beginn))
    .all();
