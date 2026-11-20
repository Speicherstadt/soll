import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/* The tables of the DATEV payroll export (S-308); re-exported by ../schema.ts */

/**
 * What a business set up with its payroll office for DATEV: consultant and client number and the
 * wage type of each item (`lohnarten`, JSON object of `Postenart` to number, packages/export). One
 * row per business; without one, everything is "nicht hinterlegt".
 */
export const datevEinstellungen = sqliteTable("datev_einstellungen", {
  betriebId: text("betrieb_id").primaryKey(),
  beraterNr: text("berater_nr"),
  mandantenNr: text("mandanten_nr"),
  lohnarten: text("lohnarten").notNull().default("{}"),
  geaendertAm: integer("geaendert_am").notNull(),
});

/**
 * The personnel number of a person in the payroll program, unique within the business: two people
 * with one number would be paid as one
 */
export const datevPersonalnummern = sqliteTable(
  "datev_personalnummern",
  {
    betriebId: text("betrieb_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    personalnummer: text("personalnummer").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.nutzerId] }),
    uniqueIndex("datev_personalnummern_einmal").on(t.betriebId, t.personalnummer),
  ],
);
