import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/* The tables of the terminal (S-801); re-exported by ../schema.ts */

/**
 * A tablet in kiosk mode (S-801). The owner creates it with a pairing code (`kopplung_hash`, valid
 * until `kopplung_bis`, used once); the tablet trades the code for its device token
 * (`token_hash`). Both are random values kept only as SHA-256. A revoked terminal
 * (`widerrufen_am`) is refused. Wrong PINs and QR codes in a row (`fehlversuche`) lock it until
 * `gesperrt_bis`, each lock (`sperren`) longer than the last.
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
