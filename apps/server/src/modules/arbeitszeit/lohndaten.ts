import { letzterTag, type Monat } from "@soll/arbeitszeit";
import type { LohnmonatEingabe } from "@soll/export";
import { and, eq, lte } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { mitgliedschaften, modellzuordnungen, monatsabschluesse } from "../../db/schema.ts";
import { standortVon } from "./monat.ts";
import type { Monatsinhalt } from "./monatsinhalt.ts";
import { lohnmodelle } from "./zuordnungen.ts";

/*
 * What payroll reads of a month (S-308): only months the business closed, from the content they were
 * closed with (S-306), so a number cannot change after the export.
 */

/** The closed months of a business in a month, with the content each was closed with */
const abgeschlossene = (db: Db, betriebId: string, monat: Monat) =>
  db
    .select({ nutzerId: monatsabschluesse.nutzerId, inhalt: monatsabschluesse.inhalt })
    .from(monatsabschluesse)
    .where(
      and(
        eq(monatsabschluesse.betriebId, betriebId),
        eq(monatsabschluesse.monat, monat),
        eq(monatsabschluesse.schritt, "abgeschlossen"),
      ),
    )
    .all()
    .map(({ nutzerId, inhalt }) => ({ nutzerId, inhalt: JSON.parse(inhalt) as Monatsinhalt }));

/** Members with a model by the month's end: their month is payroll's business */
const mitModell = (db: Db, betriebId: string, monat: Monat): string[] =>
  db
    .selectDistinct({ nutzerId: modellzuordnungen.nutzerId })
    .from(modellzuordnungen)
    .innerJoin(
      mitgliedschaften,
      and(
        eq(mitgliedschaften.betriebId, modellzuordnungen.betriebId),
        eq(mitgliedschaften.nutzerId, modellzuordnungen.nutzerId),
      ),
    )
    .where(
      and(
        eq(modellzuordnungen.betriebId, betriebId),
        lte(modellzuordnungen.gueltigAb, letzterTag(monat)),
      ),
    )
    .all()
    .map(({ nutzerId }) => nutzerId);

/**
 * The closed months of a business as `datevExport` takes them, and the persons with a model whose
 * month is not closed yet
 */
export const lohndaten = (
  db: Db,
  betriebId: string,
  monat: Monat,
): { monate: LohnmonatEingabe[]; offen: string[] } => {
  const standort = standortVon(db, betriebId);
  const monate = abgeschlossene(db, betriebId, monat).map(
    ({ nutzerId, inhalt }): LohnmonatEingabe => ({
      nutzerId,
      monat,
      tage: inhalt.tage,
      gegeneintraege: inhalt.gegeneintraege.map(({ tag, minuten }) => ({ tag, minuten })),
      modelle: lohnmodelle(db, betriebId, nutzerId),
      standort,
    }),
  );
  const geschlossen = new Set(monate.map((m) => m.nutzerId));
  const offen = mitModell(db, betriebId, monat).filter((id) => !geschlossen.has(id));
  return { monate, offen: offen.sort() };
};
