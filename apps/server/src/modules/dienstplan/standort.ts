import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { bedarfe, schichten } from "../../db/schema.ts";

/**
 * Whether a site still has shifts or needs of the plan: such a site is not removed, or its shifts
 * would stand in no week view and its need in no coverage
 */
export const standortVerplant = (db: Db, betriebId: string, standortId: string): boolean =>
  db
    .select({ id: schichten.schichtId })
    .from(schichten)
    .where(and(eq(schichten.betriebId, betriebId), eq(schichten.standortId, standortId)))
    .get() !== undefined ||
  db
    .select({ id: bedarfe.bedarfId })
    .from(bedarfe)
    .where(and(eq(bedarfe.betriebId, betriebId), eq(bedarfe.standortId, standortId)))
    .get() !== undefined;
