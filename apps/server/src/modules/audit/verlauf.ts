import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { auditGlieder } from "../../db/schema.ts";
import { type TabellenName, zeilenId } from "./tabellen.ts";

/** How often a row was written and when first and last, read from its links in the chain */
export type Verlauf = { erstes: number; letztes: number; aenderungen: number };

/** SQLite allows at most 999 variables in one statement before 3.32; stay well below */
const STUECK = 500;

/**
 * The history of rows of a table, by their keys: the instant of the first and the last link and the
 * number of changes after the first. The chain is the record of every write (CLAUDE.md), so no
 * table needs a column of its own for when a row last changed (the ICS feed of S-503 reads it for
 * CREATED, LAST-MODIFIED and SEQUENCE). A row without links is missing from the map.
 */
export const verlaufVon = (
  db: Db,
  betriebId: string,
  tabelle: TabellenName,
  schluessel: readonly Record<string, unknown>[],
): Map<string, Verlauf> => {
  const ids = schluessel.map((zeile) => zeilenId(tabelle, zeile));
  const verlauf = new Map<string, Verlauf>();
  for (let i = 0; i < ids.length; i += STUECK) {
    const glieder = db
      .select({ zeile: auditGlieder.zeile, zeitpunkt: auditGlieder.zeitpunkt })
      .from(auditGlieder)
      .where(
        and(
          eq(auditGlieder.betriebId, betriebId),
          eq(auditGlieder.tabelle, tabelle),
          inArray(auditGlieder.zeile, ids.slice(i, i + STUECK)),
        ),
      )
      .orderBy(auditGlieder.seq)
      .all();
    for (const { zeile, zeitpunkt } of glieder) {
      const bisher = verlauf.get(zeile);
      verlauf.set(
        zeile,
        bisher
          ? {
              erstes: bisher.erstes,
              letztes: Math.max(bisher.letztes, zeitpunkt),
              aenderungen: bisher.aenderungen + 1,
            }
          : { erstes: zeitpunkt, letztes: zeitpunkt, aenderungen: 0 },
      );
    }
  }
  return verlauf;
};
