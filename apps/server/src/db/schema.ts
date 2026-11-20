import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/*
 * Soll's tables. Every one carries `betrieb_id` (CLAUDE.md); writes to them go only through the audit
 * chain (src/modules/audit). Instants are UTC milliseconds in integer columns.
 */

/** One row per business; `betrieb_id` is the id of its Better Auth organization (S-106) */
export const betriebe = sqliteTable("betriebe", {
  betriebId: text("betrieb_id").primaryKey(),
  name: text("name").notNull(),
  angelegtAm: integer("angelegt_am").notNull(),
});

/**
 * A link of the audit chain. It holds the hash of the content, not the content, so the content can be
 * removed after its retention period (S-901) without breaking the chain.
 */
export const auditGlieder = sqliteTable(
  "audit_glieder",
  {
    betriebId: text("betrieb_id").notNull(),
    seq: integer("seq").notNull(),
    zeitpunkt: integer("zeitpunkt").notNull(),
    akteur: text("akteur").notNull(),
    tabelle: text("tabelle").notNull(),
    zeile: text("zeile").notNull(),
    aktion: text("aktion", { enum: ["einfuegen", "aendern", "loeschen"] }).notNull(),
    inhaltHash: text("inhalt_hash").notNull(),
    vorgaengerHash: text("vorgaenger_hash").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.seq] }),
    // The links of one row, for its history and for the check of the rows
    index("audit_glieder_zeile").on(t.betriebId, t.tabelle, t.zeile),
  ],
);

/** The content of a link as canonical JSON, kept apart from the link so it can be removed */
export const auditInhalte = sqliteTable(
  "audit_inhalte",
  {
    betriebId: text("betrieb_id").notNull(),
    seq: integer("seq").notNull(),
    inhalt: text("inhalt").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.seq] })],
);

/** The head of each business's chain, so a link cut off at the end shows in the check */
export const auditKoepfe = sqliteTable("audit_koepfe", {
  betriebId: text("betrieb_id").primaryKey(),
  seq: integer("seq").notNull(),
  hash: text("hash").notNull(),
});
