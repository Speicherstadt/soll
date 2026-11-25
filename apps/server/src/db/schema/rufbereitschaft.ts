import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/* Rufbereitschaft and the Soll from the plan (S-505); re-exported by ../schema.ts */

/**
 * A planned Rufbereitschaft (S-505): reachable from `beginn` to `ende` (UTC milliseconds), the
 * Berlin day it begins on as `tag`. `reaktion_minuten` is the time the duty allows from the call to
 * the start of work, null while not set (then it counts fully for the limits, R-12). A draft while
 * `veroeffentlicht_am` is null, like a shift (S-503). Its own table, as a new column on `schichten`
 * would have broken the content hashes of every shift already in the chain (docs/plan.md).
 */
export const rufdienste = sqliteTable(
  "rufdienste",
  {
    betriebId: text("betrieb_id").notNull(),
    rufdienstId: text("rufdienst_id").notNull(),
    standortId: text("standort_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    tag: text("tag").notNull(),
    beginn: integer("beginn").notNull(),
    ende: integer("ende").notNull(),
    reaktionMinuten: integer("reaktion_minuten"),
    veroeffentlichtAm: integer("veroeffentlicht_am"),
    angelegtVon: text("angelegt_von").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.rufdienstId] }),
    index("rufdienste_woche").on(t.betriebId, t.standortId, t.tag),
    index("rufdienste_person").on(t.betriebId, t.nutzerId, t.tag),
  ],
);

/**
 * A call-out from a Rufbereitschaft (S-505): working time from the call to the end of work, the way
 * there and back included (R-12). `ende` is null while it runs: Soll never ends it (CLAUDE.md).
 * `grund` is required when it was entered afterwards, `entfernt_grund` when it was removed; the
 * audit chain keeps every version.
 */
export const einsaetze = sqliteTable(
  "einsaetze",
  {
    betriebId: text("betrieb_id").notNull(),
    einsatzId: text("einsatz_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    rufdienstId: text("rufdienst_id").notNull(),
    beginn: integer("beginn").notNull(),
    ende: integer("ende"),
    grund: text("grund"),
    entfernt: integer("entfernt", { mode: "boolean" }).notNull().default(false),
    entferntGrund: text("entfernt_grund"),
    erstelltVon: text("erstellt_von").notNull(),
    erstelltAm: integer("erstellt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.einsatzId] }),
    index("einsaetze_person").on(t.betriebId, t.nutzerId, t.beginn),
  ],
);

/**
 * Where the Soll of the business comes from from a day on (S-505): the working-time model or the
 * published plan. A history: the entry on or before a day decides it, and a new one begins after
 * the last closed month, so a closed month keeps its records.
 */
export const sollquellen = sqliteTable(
  "sollquellen",
  {
    betriebId: text("betrieb_id").notNull(),
    ab: text("ab").notNull(),
    quelle: text("quelle", { enum: ["modell", "plan"] }).notNull(),
    angelegtVon: text("angelegt_von").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.ab] })],
);
