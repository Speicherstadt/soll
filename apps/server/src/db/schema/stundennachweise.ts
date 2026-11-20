import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/*
 * The tables of the Stundennachweis (BAULISTE.md S-605; re-exported by ../schema.ts): a report of
 * the hours on one order, signed by the customer on the phone. A report exists only signed; it keeps
 * its content frozen as canonical JSON (`inhalt`, with the signature as strokes of whole numbers)
 * and the SHA-256 of that content, which the PDF prints and the link of the audit chain hashes.
 */

/** A signed report, numbered per business (`nummer` 1, 2, …) */
export const stundennachweise = sqliteTable(
  "stundennachweise",
  {
    betriebId: text("betrieb_id").notNull(),
    nachweisId: text("nachweis_id").notNull(),
    nummer: integer("nummer").notNull(),
    projektId: text("projekt_id").notNull(),
    // the person whose bookings it holds, null for everyone's (owner and planner only)
    nutzerId: text("nutzer_id"),
    von: text("von").notNull(),
    bis: text("bis").notNull(),
    inhalt: text("inhalt").notNull(),
    inhaltHash: text("inhalt_hash").notNull(),
    unterschriebenAm: integer("unterschrieben_am").notNull(),
    erstelltVon: text("erstellt_von").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.nachweisId] }),
    uniqueIndex("stundennachweise_nummer").on(t.betriebId, t.nummer),
    index("stundennachweise_projekt").on(t.betriebId, t.projektId),
  ],
);

/**
 * The bookings a signed report holds: the key over the booking keeps each in one report at most,
 * also with two signatures at once, and locks it against changes (`409 unterschrieben`)
 */
export const stundennachweisBuchungen = sqliteTable(
  "stundennachweis_buchungen",
  {
    betriebId: text("betrieb_id").notNull(),
    buchungId: text("buchung_id").notNull(),
    nachweisId: text("nachweis_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.buchungId] }),
    index("stundennachweis_buchungen_nachweis").on(t.betriebId, t.nachweisId),
  ],
);
