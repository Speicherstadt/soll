import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/*
 * The tables of the link to Haben (BAULISTE.md S-606; re-exported by ../schema.ts): where a
 * business reaches its Haben and with which API token, and what Soll handed over to it. The token
 * is a secret: encrypted with SOLL_SECRET_KEY (CLAUDE.md, "Secrets"), never shown again.
 */

/**
 * The Haben of a business: its address (without `/api/v1`) and the API token, encrypted (AES-256-GCM,
 * purpose `haben_zugaenge:token`); one per business
 */
export const habenZugaenge = sqliteTable("haben_zugaenge", {
  betriebId: text("betrieb_id").primaryKey(),
  adresse: text("adresse").notNull(),
  token: text("token").notNull(),
  geaendertAm: integer("geaendert_am").notNull(),
});

/**
 * A booking handed over to Haben as a Leistung (`POST /api/v1/leistungen` with `source` "soll" and the
 * booking's id as `externalId`, docs/api.md of Haben). The row is written together with "abgerechnet"
 * and locks the booking; `inhalt` is the booking as billed (canonical JSON: day, minutes, activity,
 * note, billable, rate, order), which every try sends; `leistung_id` Haben's id once it answered 200
 * or 201. Until then `fehler` (Soll's code) and `meldung` (Haben's text) say why not.
 */
export const habenUebergaben = sqliteTable(
  "haben_uebergaben",
  {
    betriebId: text("betrieb_id").notNull(),
    buchungId: text("buchung_id").notNull(),
    inhalt: text("inhalt").notNull(),
    leistungId: text("leistung_id"),
    gesendetAm: integer("gesendet_am"),
    fehler: text("fehler"),
    meldung: text("meldung"),
    versuchtAm: integer("versucht_am"),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.buchungId] })],
);
