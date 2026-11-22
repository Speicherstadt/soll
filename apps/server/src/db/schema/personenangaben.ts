import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/* What the rules need of a person (S-502); re-exported by ../schema.ts */

/**
 * What the rules need of a person and nothing more (S-502, docs/plan.md "Daten zur Person"): the
 * birth date (JArbSchG), Wechselschicht (§ 2 Abs. 5 Nr. 1 ArbZG), Arbeit auf Abruf (§ 12 TzBfG) and
 * the spans of the Mutterschutz as a JSON array of `{ von, bis }` (bis null while it lasts), which
 * say neither pregnant nor breastfeeding (Art. 9 DSGVO). Only the owner reads and writes them.
 */
export const personenangaben = sqliteTable(
  "personenangaben",
  {
    betriebId: text("betrieb_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    geburtsdatum: text("geburtsdatum"),
    wechselschicht: integer("wechselschicht", { mode: "boolean" }).notNull().default(false),
    abruf: integer("abruf", { mode: "boolean" }).notNull().default(false),
    mutterschutz: text("mutterschutz").notNull().default("[]"),
    geaendertAm: integer("geaendert_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.nutzerId] })],
);
