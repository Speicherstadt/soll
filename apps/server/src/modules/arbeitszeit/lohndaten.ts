import { beginnInBerlin, ersterTag, letzterTag, type Monat, plusMonate } from "@soll/arbeitszeit";
import type { LohnmonatEingabe } from "@soll/export";
import { and, eq, gte, lt, lte } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import {
  mitgliedschaften,
  modellzuordnungen,
  monatsabschluesse,
  stempelungen,
} from "../../db/schema.ts";
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

/** Persons with a model by the month's end, members or not */
const mitModell = (db: Db, betriebId: string, monat: Monat): string[] =>
  db
    .selectDistinct({ nutzerId: modellzuordnungen.nutzerId })
    .from(modellzuordnungen)
    .where(
      and(
        eq(modellzuordnungen.betriebId, betriebId),
        lte(modellzuordnungen.gueltigAb, letzterTag(monat)),
      ),
    )
    .all()
    .map(({ nutzerId }) => nutzerId);

const mitglieder = (db: Db, betriebId: string): Set<string> =>
  new Set(
    db
      .select({ nutzerId: mitgliedschaften.nutzerId })
      .from(mitgliedschaften)
      .where(eq(mitgliedschaften.betriebId, betriebId))
      .all()
      .map(({ nutzerId }) => nutzerId),
  );

/** Persons who stamped in the month: someone who left since worked in it all the same */
const mitStempeln = (db: Db, betriebId: string, monat: Monat): Set<string> =>
  new Set(
    db
      .selectDistinct({ nutzerId: stempelungen.nutzerId })
      .from(stempelungen)
      .where(
        and(
          eq(stempelungen.betriebId, betriebId),
          eq(stempelungen.entfernt, false),
          gte(stempelungen.zeitpunkt, beginnInBerlin(ersterTag(monat))),
          lt(stempelungen.zeitpunkt, beginnInBerlin(ersterTag(plusMonate(monat, 1)))),
        ),
      )
      .all()
      .map(({ nutzerId }) => nutzerId),
  );

/**
 * Persons with a model by the month's end whose month is payroll's business: the members, and
 * whoever left since but stamped in it, so a file never leaves out someone who worked (docs/plan.md,
 * "Was der DATEV-Export liest")
 */
const beschaeftigt = (db: Db, betriebId: string, monat: Monat): string[] => {
  const dabei = mitglieder(db, betriebId);
  const gestempelt = mitStempeln(db, betriebId, monat);
  return mitModell(db, betriebId, monat).filter((id) => dabei.has(id) || gestempelt.has(id));
};

/** Whether a month of the person was ever closed in the business, also after they left */
export const hatAbschluss = (db: Db, betriebId: string, nutzerId: string): boolean =>
  db
    .select({ nutzerId: monatsabschluesse.nutzerId })
    .from(monatsabschluesse)
    .where(
      and(
        eq(monatsabschluesse.betriebId, betriebId),
        eq(monatsabschluesse.nutzerId, nutzerId),
        eq(monatsabschluesse.schritt, "abgeschlossen"),
      ),
    )
    .get() !== undefined;

/** The persons with a closed month in the business, members or not */
export const mitAbschluss = (db: Db, betriebId: string): string[] =>
  db
    .selectDistinct({ nutzerId: monatsabschluesse.nutzerId })
    .from(monatsabschluesse)
    .where(
      and(
        eq(monatsabschluesse.betriebId, betriebId),
        eq(monatsabschluesse.schritt, "abgeschlossen"),
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
  const offen = beschaeftigt(db, betriebId, monat).filter((id) => !geschlossen.has(id));
  return { monate, offen: offen.sort() };
};
