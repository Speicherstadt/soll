import { isNull } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/* The tables of the terminal (S-801, S-802); re-exported by ../schema.ts */

/**
 * A tablet in kiosk mode (S-801). The owner creates it with a pairing code (`kopplung_hash`, valid
 * until `kopplung_bis`, used once); the tablet trades the code for its device token
 * (`token_hash`). Both are random values kept only as SHA-256. A revoked terminal
 * (`widerrufen_am`) is refused. Wrong PINs and QR codes (`fehlversuche`) lock it until
 * `gesperrt_bis`, each lock (`sperren`) longer than the last; both count per calendar day
 * (`fehler_tag`, Europe/Berlin), and a person recognised lifts nothing. `schluessel` is the public
 * half of the tablet's non-extractable ECDSA P-256 key (JWK, canonical JSON of kty, crv, x and y),
 * against which the server checks the entries of its offline queue (S-803); set once per pairing.
 */
export const terminals = sqliteTable(
  "terminals",
  {
    betriebId: text("betrieb_id").notNull(),
    terminalId: text("terminal_id").notNull(),
    name: text("name").notNull(),
    kopplungHash: text("kopplung_hash").unique(),
    kopplungBis: integer("kopplung_bis"),
    tokenHash: text("token_hash").unique(),
    gekoppeltAm: integer("gekoppelt_am"),
    widerrufenAm: integer("widerrufen_am"),
    fehlversuche: integer("fehlversuche").notNull().default(0),
    sperren: integer("sperren").notNull().default(0),
    gesperrtBis: integer("gesperrt_bis"),
    fehlerTag: text("fehler_tag"),
    schluessel: text("schluessel"),
    angelegtVon: text("angelegt_von").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.terminalId] })],
);

/**
 * A person's QR code for the terminal (S-801): a random token, kept only as SHA-256; issuing a new
 * one replaces the old, removing the row revokes it
 */
export const ausweise = sqliteTable(
  "ausweise",
  {
    betriebId: text("betrieb_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    ausgestelltVon: text("ausgestellt_von").notNull(),
    ausgestelltAm: integer("ausgestellt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.nutzerId] })],
);

/**
 * A person's NFC card for the terminal (S-802). `art` "uid" is a plain card: its UID can be copied,
 * so it recognises the person only together with their PIN; "ntag424" is an NTAG 424 DNA that
 * recognises the person alone by its SUN message. The UID is kept only as a keyed hash
 * (`uid_kennung`, like the PIN's), once per business among the cards in use; the card's
 * SDMMetaReadKey and SDMFileReadKey only encrypted (`schluessel`). `zaehler` is the highest read
 * counter seen, so a SUN message read once is refused the next time. Revoking (`widerrufen_am`)
 * deletes the keys and keeps the row with its counter and its person; a card entered again is a
 * new row for its new person that starts from that counter: the card's counter never goes back, so
 * neither may Soll's.
 */
export const karten = sqliteTable(
  "karten",
  {
    betriebId: text("betrieb_id").notNull(),
    karteId: text("karte_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    art: text("art", { enum: ["uid", "ntag424"] }).notNull(),
    uidKennung: text("uid_kennung").notNull(),
    schluessel: text("schluessel"),
    zaehler: integer("zaehler"),
    widerrufenAm: integer("widerrufen_am"),
    angelegtVon: text("angelegt_von").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.karteId] }),
    uniqueIndex("karten_uid_aktiv").on(t.betriebId, t.uidKennung).where(isNull(t.widerrufenAm)),
  ],
);

/**
 * Every read counter of an NTAG 424 DNA the terminal took (S-803), with when it was read: an entry
 * of an offline queue may bring a counter below the highest one seen, read before a later online
 * read; it counts once, and only if it fits before the first later read (docs/plan.md, "SUN-Nachricht
 * aus der Warteschlange")
 */
export const kartenLesungen = sqliteTable(
  "karten_lesungen",
  {
    betriebId: text("betrieb_id").notNull(),
    karteId: text("karte_id").notNull(),
    zaehler: integer("zaehler").notNull(),
    gelesenAm: integer("gelesen_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.karteId, t.zaehler] })],
);

/**
 * Every entry of a terminal's offline queue the server received with a valid signature (S-803), by
 * its running number: the SHA-256 of the signed text (`inhalt_hash`) and what came of it, the stamp
 * made (`stempel_id`) or why it was refused (`grund`). The same entry again gives the same answer;
 * another content under a number already taken is refused; a missing number is a gap the owner
 * sees. The credential itself is never stored.
 */
export const terminalEintraege = sqliteTable(
  "terminal_eintraege",
  {
    betriebId: text("betrieb_id").notNull(),
    terminalId: text("terminal_id").notNull(),
    nummer: integer("nummer").notNull(),
    inhaltHash: text("inhalt_hash").notNull(),
    art: text("art").notNull(),
    geraetZeitpunkt: integer("geraet_zeitpunkt").notNull(),
    stempelId: text("stempel_id"),
    grund: text("grund"),
    empfangenAm: integer("empfangen_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.terminalId, t.nummer] })],
);
