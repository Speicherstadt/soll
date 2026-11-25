import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/* The tables of the shift swap (S-504); re-exported by ../schema.ts */

export const TAUSCH_STATUS = [
  "offen",
  "uebernommen",
  "freigegeben",
  "abgelehnt",
  "zurueckgezogen",
  "hinfaellig",
] as const;

/**
 * A swap of a published shift (S-504): `anbieter_id` offers it, to everyone who can take it
 * (`an_nutzer_id` null) or to one colleague; `uebernehmer_id` takes it over, then owner or planner
 * approve or refuse it with a reason. The shift changes its person only on approval. An offer has no
 * reason of its own: it would invite health data (Art. 9 DSGVO). It expires when the shift begins,
 * which is read, not written.
 */
export const schichttausche = sqliteTable(
  "schichttausche",
  {
    betriebId: text("betrieb_id").notNull(),
    tauschId: text("tausch_id").notNull(),
    schichtId: text("schicht_id").notNull(),
    anbieterId: text("anbieter_id").notNull(),
    anNutzerId: text("an_nutzer_id"),
    uebernehmerId: text("uebernehmer_id"),
    status: text("status", { enum: TAUSCH_STATUS }).notNull(),
    grund: text("grund"),
    angebotenAm: integer("angeboten_am").notNull(),
    uebernommenAm: integer("uebernommen_am"),
    entschiedenVon: text("entschieden_von"),
    entschiedenAm: integer("entschieden_am"),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.tauschId] }),
    index("schichttausche_schicht").on(t.betriebId, t.schichtId),
  ],
);

/**
 * Whether a swap needs approval (S-504): without a row it does; the owner may let a takeover hold at
 * once, as long as the rules find no Verstoß for whoever takes the shift. Its own table, so the
 * content hashes of the businesses already in the chain stay as they are.
 */
export const tauschregeln = sqliteTable("tauschregeln", {
  betriebId: text("betrieb_id").primaryKey(),
  ohneFreigabe: integer("ohne_freigabe", { mode: "boolean" }).notNull(),
});
