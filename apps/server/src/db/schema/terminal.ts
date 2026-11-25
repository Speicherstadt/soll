import { isNull } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/* The tables of the terminal (S-801, S-802); re-exported by ../schema.ts */

/**
 * A tablet in kiosk mode (S-801). The owner creates it with a pairing code (`kopplung_hash`, valid
 * until `kopplung_bis`, used once); the tablet trades the code for its device token
 * (`token_hash`). Both are random values kept only as SHA-256. A revoked terminal
 * (`widerrufen_am`) is refused. Wrong PINs and QR codes (`fehlversuche`) lock it until
 * `gesperrt_bis`, each lock (`sperren`) longer than the last; both count per calendar day
 * (`fehler_tag`, Europe/Berlin), and a person recognised lifts nothing.
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
