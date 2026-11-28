import type { PlanSchicht, Tag } from "@soll/arbeitszeit";
import { and, asc, eq, gte, isNotNull, lte } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { schichten } from "../../db/schema.ts";

/*
 * Leaf query module for published shift data read by `arbeitszeit` (Soll aus dem Plan, S-505),
 * keeping `arbeitszeit` and `dienstplan` free of circular imports.
 */

/** Published shifts of a person whose working day lies in `[von, bis]` */
export const veroeffentlichteSchichten = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  von: Tag,
  bis: Tag,
): PlanSchicht[] =>
  db
    .select({
      schichtId: schichten.schichtId,
      standortId: schichten.standortId,
      tag: schichten.tag,
      beginn: schichten.beginn,
      ende: schichten.ende,
      pauseMinuten: schichten.pauseMinuten,
      rolle: schichten.rolle,
      nutzerId: schichten.nutzerId,
    })
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
