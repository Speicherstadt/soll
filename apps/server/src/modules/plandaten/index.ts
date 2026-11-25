import type { PlanRufdienst, PlanSchicht, Tag } from "@soll/arbeitszeit";
import { and, asc, eq, gte, isNotNull, lte } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { rufdienste, schichten } from "../../db/schema.ts";

/*
 * What working time reads of the plan (S-505), read only, like the Auskunft: the published shifts
 * of a person for the Soll from the plan, and the Rufbereitschaft for call-outs and the rules. The
 * module Dienstplan writes these tables; working time never does, and the module Dienstplan reads
 * working time, so this read sits between them instead of one module importing the other both ways.
 */

export type Rufdienst = typeof rufdienste.$inferSelect & PlanRufdienst;

/** A person's published shifts whose working day lies from `von` through `bis`, at every site */
export const veroeffentlichteSchichten = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  von: Tag,
  bis: Tag,
): PlanSchicht[] =>
  db
    .select()
    .from(schichten)
    .where(
      and(
        eq(schichten.betriebId, betriebId),
        eq(schichten.nutzerId, nutzerId),
        isNotNull(schichten.veroeffentlichtAm),
        gte(schichten.tag, von),
        lte(schichten.tag, bis),
      ),
    )
    .orderBy(asc(schichten.beginn))
    .all();

/**
 * A person's Rufbereitschaft beginning on the days from `von` through `bis`; drafts only with
 * `mitEntwurf` (whoever plans checks the draft, everyone else reads only what is published)
 */
export const rufdiensteVon = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  von: Tag,
  bis: Tag,
  mitEntwurf = false,
): Rufdienst[] =>
  db
    .select()
    .from(rufdienste)
    .where(
      and(
        eq(rufdienste.betriebId, betriebId),
        eq(rufdienste.nutzerId, nutzerId),
        gte(rufdienste.tag, von),
        lte(rufdienste.tag, bis),
        ...(mitEntwurf ? [] : [isNotNull(rufdienste.veroeffentlichtAm)]),
      ),
    )
    .orderBy(asc(rufdienste.beginn))
    .all();

/** A Rufbereitschaft of the business by its id, if there is one */
export const rufdienstLesen = (db: Db, betriebId: string, rufdienstId: string) =>
  db
    .select()
    .from(rufdienste)
    .where(and(eq(rufdienste.betriebId, betriebId), eq(rufdienste.rufdienstId, rufdienstId)))
    .get();

/**
 * The person's published Rufbereitschaft that holds an instant (from its start, before its end),
 * or undefined: a call-out begins in one (S-505)
 */
export const rufdienstUm = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  zeitpunkt: number,
): Rufdienst | undefined =>
  db
    .select()
    .from(rufdienste)
    .where(
      and(
        eq(rufdienste.betriebId, betriebId),
        eq(rufdienste.nutzerId, nutzerId),
        isNotNull(rufdienste.veroeffentlichtAm),
        lte(rufdienste.beginn, zeitpunkt),
        gte(rufdienste.ende, zeitpunkt + 1),
      ),
    )
    .orderBy(asc(rufdienste.beginn))
    .get();
