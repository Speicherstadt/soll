import { isNull } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/*
 * The tables of the module Projektzeit (BAULISTE.md S-601; re-exported by ../schema.ts): customers, orders, activities and hourly
 * rates. Like every table of Soll they carry `betrieb_id` and are written only through the audit chain;
 * money in whole cents, durations in whole minutes (CLAUDE.md). What an order or a rate still names is
 * archived (`archiviert_am`) instead of removed. `extern_quelle` and `extern_id` name the row in
 * another source (Haben's contact for S-606, a tool of an import), both or neither, unique per business.
 */

/** A customer; the orders belong to one */
export const kunden = sqliteTable(
  "kunden",
  {
    betriebId: text("betrieb_id").notNull(),
    kundeId: text("kunde_id").notNull(),
    name: text("name").notNull(),
    // the customer number of the business, free text, empty for none
    nummer: text("nummer").notNull().default(""),
    externQuelle: text("extern_quelle"),
    externId: text("extern_id"),
    archiviertAm: integer("archiviert_am"),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.kundeId] }),
    uniqueIndex("kunden_extern").on(t.betriebId, t.externQuelle, t.externId),
  ],
);

/**
 * An order (in the data model `projekte`) of one customer, with a budget in whole minutes and in whole
 * cents (either, both or none) and the threshold of its warning in whole percent
 */
export const projekte = sqliteTable(
  "projekte",
  {
    betriebId: text("betrieb_id").notNull(),
    projektId: text("projekt_id").notNull(),
    kundeId: text("kunde_id").notNull(),
    name: text("name").notNull(),
    // the order number of the business, free text, empty for none
    nummer: text("nummer").notNull().default(""),
    budgetMinuten: integer("budget_minuten"),
    budgetCent: integer("budget_cent"),
    warnungProzent: integer("warnung_prozent").notNull().default(80),
    externQuelle: text("extern_quelle"),
    externId: text("extern_id"),
    archiviertAm: integer("archiviert_am"),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.projektId] }),
    index("projekte_kunde").on(t.betriebId, t.kundeId),
    uniqueIndex("projekte_extern").on(t.betriebId, t.externQuelle, t.externId),
  ],
);

/**
 * An activity of the business. The four fixed internal ones (FESTE_TAETIGKEITEN in packages/
 * arbeitszeit) are no rows of their own: a row with their id (and an empty name) only keeps whether the
 * business bills them.
 */
export const taetigkeiten = sqliteTable(
  "taetigkeiten",
  {
    betriebId: text("betrieb_id").notNull(),
    taetigkeitId: text("taetigkeit_id").notNull(),
    name: text("name").notNull(),
    abrechenbar: integer("abrechenbar", { mode: "boolean" }).notNull(),
    externQuelle: text("extern_quelle"),
    externId: text("extern_id"),
    archiviertAm: integer("archiviert_am"),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.taetigkeitId] }),
    uniqueIndex("taetigkeiten_extern").on(t.betriebId, t.externQuelle, t.externId),
  ],
);

/**
 * An hourly rate in whole cents from a day on, for any of customer, order, activity and person (none:
 * the business's default); `stundensatz` in packages/arbeitszeit picks the one in force. `schluessel`
 * is the canonical JSON of the four and the day, so the same rate from the same day exists once
 * (a unique index over columns that may be NULL would not see the double).
 */
export const stundensaetze = sqliteTable(
  "stundensaetze",
  {
    betriebId: text("betrieb_id").notNull(),
    satzId: text("satz_id").notNull(),
    kundeId: text("kunde_id"),
    projektId: text("projekt_id"),
    taetigkeitId: text("taetigkeit_id"),
    nutzerId: text("nutzer_id"),
    gueltigAb: text("gueltig_ab").notNull(),
    centProStunde: integer("cent_pro_stunde").notNull(),
    schluessel: text("schluessel").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.satzId] }),
    uniqueIndex("stundensaetze_schluessel").on(t.betriebId, t.schluessel),
  ],
);

/**
 * A booking of project time (S-602): a person's span on an order (none for internal time) and an
 * activity, begin and end on whole minutes in UTC milliseconds, `ende` null while the stopwatch runs
 * (one per person, the partial unique index). `tag` is the working day the booking falls in, fixed
 * when it is written, so its rate and its bill do not move with a later correction of the stamps.
 * `abgerechnet_am` locks it; `cent_pro_stunde` keeps the rate it was billed with (null: nicht
 * hinterlegt), so removing a rate later changes no bill.
 */
export const projektzeiten = sqliteTable(
  "projektzeiten",
  {
    betriebId: text("betrieb_id").notNull(),
    buchungId: text("buchung_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    projektId: text("projekt_id"),
    taetigkeitId: text("taetigkeit_id").notNull(),
    beginn: integer("beginn").notNull(),
    ende: integer("ende"),
    tag: text("tag").notNull(),
    notiz: text("notiz").notNull().default(""),
    abgerechnetAm: integer("abgerechnet_am"),
    centProStunde: integer("cent_pro_stunde"),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.buchungId] }),
    index("projektzeiten_person").on(t.betriebId, t.nutzerId, t.beginn),
    index("projektzeiten_projekt").on(t.betriebId, t.projektId),
    index("projektzeiten_taetigkeit").on(t.betriebId, t.taetigkeitId),
    uniqueIndex("projektzeiten_laeuft").on(t.betriebId, t.nutzerId).where(isNull(t.ende)),
  ],
);
