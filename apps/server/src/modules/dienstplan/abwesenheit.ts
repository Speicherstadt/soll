import { uhrzeitText } from "@soll/export";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { schichten, schichtvorlagen } from "../../db/schema.ts";
import type { Schichtquelle } from "../arbeitszeit/index.ts";
import { modulAktiv } from "../betrieb/index.ts";

/**
 * The plan's answer to absences (S-401, S-501): the shifts of one person whose working day falls in
 * a span, ordered by their beginning. Drafts only when asked for, as only whoever plans may know
 * them (S-503); nothing while the business has the module switched off.
 */
export const schichtquelle =
  (db: Db): Schichtquelle =>
  (betriebId, nutzerId, von, bis, mitEntwurf) => {
    if (!modulAktiv(db, betriebId, "dienstplan")) return [];
    return db
      .select({ schicht: schichten, vorlage: schichtvorlagen.name })
      .from(schichten)
      .leftJoin(
        schichtvorlagen,
        and(
          eq(schichtvorlagen.betriebId, schichten.betriebId),
          eq(schichtvorlagen.vorlageId, schichten.vorlageId),
        ),
      )
      .where(
        and(
          eq(schichten.betriebId, betriebId),
          eq(schichten.nutzerId, nutzerId),
          gte(schichten.tag, von),
          lte(schichten.tag, bis),
          mitEntwurf ? undefined : isNotNull(schichten.veroeffentlichtAm),
        ),
      )
      .orderBy(schichten.beginn)
      .all()
      .map(({ schicht, vorlage }) => ({
        schichtId: schicht.schichtId,
        nutzerId,
        tag: schicht.tag,
        beginn: schicht.beginn,
        ende: schicht.ende,
        bezeichnung:
          vorlage || schicht.rolle || `${uhrzeitText(schicht.beginn)}–${uhrzeitText(schicht.ende)}`,
        entwurf: schicht.veroeffentlichtAm === null,
      }));
  };
