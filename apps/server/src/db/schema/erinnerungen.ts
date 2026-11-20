import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* The tables of reminders and Web Push (S-307); re-exported by ../schema.ts */

/**
 * Keys of the instance itself, not of one business (S-307): the VAPID key pair for Web Push, created
 * on the first start. They stand under the reserved `betrieb_id` "instanz" with a chain of their
 * own; the private key is encrypted with SOLL_SECRET_KEY (modules/geheim).
 */
export const instanzschluessel = sqliteTable(
  "instanzschluessel",
  {
    betriebId: text("betrieb_id").notNull(),
    name: text("name").notNull(),
    oeffentlich: text("oeffentlich").notNull(),
    // encrypted (modules/geheim, purpose "instanzschluessel:<name>")
    privat: text("privat").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.name] })],
);

/**
 * A device of a person that receives Web Push (S-307): the subscription (endpoint, p256dh, auth) is
 * encrypted, its endpoint's SHA-256 finds it again; `sprache` is the app's language on the device,
 * for the text of the notification
 */
export const pushAbos = sqliteTable(
  "push_abos",
  {
    betriebId: text("betrieb_id").notNull(),
    aboId: text("abo_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    endpunktHash: text("endpunkt_hash").notNull(),
    abo: text("abo").notNull(),
    sprache: text("sprache").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.aboId] }),
    uniqueIndex("push_abos_endpunkt").on(t.betriebId, t.endpunktHash),
    index("push_abos_person").on(t.betriebId, t.nutzerId),
  ],
);

/**
 * A reminder that went out (S-307), written before it is sent: the unique index lets each one go
 * out at most once. `bezug` names what it is about: the Kommen of the shift, the break owed in it,
 * or the month.
 */
export const erinnerungen = sqliteTable(
  "erinnerungen",
  {
    betriebId: text("betrieb_id").notNull(),
    erinnerungId: text("erinnerung_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    art: text("art", { enum: ["ausstempeln", "pause", "monat"] }).notNull(),
    bezug: text("bezug").notNull(),
    erstelltAm: integer("erstellt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.erinnerungId] }),
    uniqueIndex("erinnerungen_einmal").on(t.betriebId, t.nutzerId, t.art, t.bezug),
  ],
);

/** Which reminders a person wants (S-307); without a row all of them, with mail as a fallback */
export const erinnerungseinstellungen = sqliteTable(
  "erinnerungseinstellungen",
  {
    betriebId: text("betrieb_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    ausstempeln: integer("ausstempeln", { mode: "boolean" }).notNull(),
    pause: integer("pause", { mode: "boolean" }).notNull(),
    monat: integer("monat", { mode: "boolean" }).notNull(),
    mail: integer("mail", { mode: "boolean" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.nutzerId] })],
);

/**
 * The times of the business for reminders (S-307), set by the owner; without a row the defaults of
 * modules/erinnerungen (10 hours open, 15 minutes before a break, the 1st of the following month)
 */
export const erinnerungsregeln = sqliteTable("erinnerungsregeln", {
  betriebId: text("betrieb_id").primaryKey(),
  gehenMinuten: integer("gehen_minuten").notNull(),
  pauseVorlauf: integer("pause_vorlauf").notNull(),
  monatTag: integer("monat_tag").notNull(),
});
