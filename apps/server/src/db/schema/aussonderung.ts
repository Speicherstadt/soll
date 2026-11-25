import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/* The record of each removal after the retention period (S-901); re-exported by ../schema.ts */

/**
 * A closed month of one person whose content was removed once its retention period ended
 * (docs/plan.md, "Aufbewahrung je Monatsabschluss"). The row is itself a link in the audit chain, so
 * the removal shows there; it keeps no content of the month, only which month it was, which closing
 * (`abschluss_id`, so the check page still recognises the person's Prüfwert), the years of the
 * period and the count of rows and stored contents removed. The month stays locked.
 */
export const aussonderungen = sqliteTable(
  "aussonderungen",
  {
    betriebId: text("betrieb_id").notNull(),
    aussonderungId: text("aussonderung_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    monat: text("monat").notNull(),
    abschlussId: text("abschluss_id").notNull(),
    // 2 or 8: the retention period in years (AO § 147 Abs. 3, ArbZG § 16 Abs. 2)
    jahre: integer("jahre").notNull(),
    abgeschlossenAm: integer("abgeschlossen_am").notNull(),
    ausgesondertAm: integer("ausgesondert_am").notNull(),
    zeilen: integer("zeilen").notNull(),
    inhalte: integer("inhalte").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.aussonderungId] }),
    uniqueIndex("aussonderungen_monat").on(t.betriebId, t.nutzerId, t.monat),
    uniqueIndex("aussonderungen_abschluss").on(t.betriebId, t.abschlussId),
  ],
);
