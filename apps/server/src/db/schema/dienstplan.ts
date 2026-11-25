import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/* The tables of the shift plan (S-501); re-exported by ../schema.ts */

/**
 * A shift template of the plan (S-501): times on the Berlin clock as minutes after midnight, an end
 * at or before the beginning on the next day, the break and the role in whole minutes and plain
 * text; for every site of the business, or for one (`standort_id`)
 */
export const schichtvorlagen = sqliteTable(
  "schichtvorlagen",
  {
    betriebId: text("betrieb_id").notNull(),
    vorlageId: text("vorlage_id").notNull(),
    name: text("name").notNull(),
    beginnMinute: integer("beginn_minute").notNull(),
    endeMinute: integer("ende_minute").notNull(),
    pauseMinuten: integer("pause_minuten").notNull().default(0),
    rolle: text("rolle").notNull().default(""),
    standortId: text("standort_id"),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.vorlageId] })],
);

/**
 * A planned shift (S-501): the instants in UTC milliseconds and the Berlin day it begins on, which
 * is its working day; `nutzer_id` null while nobody is planned ("offen"). It is a draft while
 * `veroeffentlicht_am` is null: only owner and planner see it until it is published (S-503). The
 * rules of S-502 read it as a `PruefTag`, a swap (S-504) changes its person.
 */
export const schichten = sqliteTable(
  "schichten",
  {
    betriebId: text("betrieb_id").notNull(),
    schichtId: text("schicht_id").notNull(),
    standortId: text("standort_id").notNull(),
    tag: text("tag").notNull(),
    beginn: integer("beginn").notNull(),
    ende: integer("ende").notNull(),
    pauseMinuten: integer("pause_minuten").notNull().default(0),
    rolle: text("rolle").notNull().default(""),
    nutzerId: text("nutzer_id"),
    vorlageId: text("vorlage_id"),
    veroeffentlichtAm: integer("veroeffentlicht_am"),
    angelegtVon: text("angelegt_von").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.schichtId] }),
    index("schichten_woche").on(t.betriebId, t.standortId, t.tag),
    index("schichten_person").on(t.betriebId, t.nutzerId, t.tag),
  ],
);

/**
 * The need of a site (S-501): `anzahl` people of a role on a weekday (1 Monday to 7 Sunday) from
 * one time to another on the Berlin clock, every week
 */
export const bedarfe = sqliteTable(
  "bedarfe",
  {
    betriebId: text("betrieb_id").notNull(),
    bedarfId: text("bedarf_id").notNull(),
    standortId: text("standort_id").notNull(),
    rolle: text("rolle").notNull(),
    wochentag: integer("wochentag").notNull(),
    beginnMinute: integer("beginn_minute").notNull(),
    endeMinute: integer("ende_minute").notNull(),
    anzahl: integer("anzahl").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.bedarfId] })],
);

/**
 * The calendar feed of a person in a business (S-503): one per person, its token kept only as its
 * SHA-256, like the API tokens (S-607). `sprache` is the app's language when it was issued, for the
 * texts of the feed, which a calendar app fetches without one. Issued again, the hash changes and
 * the old link stops at once; revoked, the row goes.
 */
export const kalenderAbos = sqliteTable(
  "kalender_abos",
  {
    betriebId: text("betrieb_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    sprache: text("sprache").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.nutzerId] })],
);
