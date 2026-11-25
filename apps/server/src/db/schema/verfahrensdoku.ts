import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/* The business's statements for its Verfahrensdokumentation (S-902); re-exported by ../schema.ts */

/**
 * What only the business can state for its Verfahrensdokumentation (GoBD Rz. 151 ff., § 146 Abs. 2
 * AO): legal form, address, who is responsible, where data and backups are kept, who runs the
 * server, how it is backed up and where the keys lie (the place only, never a secret), and its own
 * sections as a JSON array of `{ titel, text }`. One row per business; every change is a link in
 * the audit chain, which makes the statements versioned (Rz. 154). Only the owner writes them.
 */
export const verfahrensdokuAngaben = sqliteTable("verfahrensdoku_angaben", {
  betriebId: text("betrieb_id").primaryKey(),
  rechtsform: text("rechtsform").notNull().default(""),
  anschrift: text("anschrift").notNull().default(""),
  verantwortlich: text("verantwortlich").notNull().default(""),
  aufbewahrungsort: text("aufbewahrungsort").notNull().default(""),
  serverbetrieb: text("serverbetrieb").notNull().default(""),
  datensicherung: text("datensicherung").notNull().default(""),
  schluesselablage: text("schluesselablage").notNull().default(""),
  eigene: text("eigene").notNull().default("[]"),
  geaendertAm: integer("geaendert_am").notNull(),
});
