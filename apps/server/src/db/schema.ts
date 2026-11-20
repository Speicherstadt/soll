import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/*
 * Soll's tables. Every one carries `betrieb_id` (CLAUDE.md); writes to them go only through the audit
 * chain (src/modules/audit). Instants are UTC milliseconds in integer columns.
 */

/** One row per business; `betrieb_id` is the id of its Better Auth organization (S-106) */
export const betriebe = sqliteTable("betriebe", {
  betriebId: text("betrieb_id").primaryKey(),
  name: text("name").notNull(),
  angelegtAm: integer("angelegt_am").notNull(),
  // The modules a business uses (docs/plan.md, "Module"); switching one off deletes no data
  modulArbeitszeit: integer("modul_arbeitszeit", { mode: "boolean" }).notNull().default(true),
  modulDienstplan: integer("modul_dienstplan", { mode: "boolean" }).notNull().default(false),
  modulProjektzeit: integer("modul_projektzeit", { mode: "boolean" }).notNull().default(false),
  modulTerminal: integer("modul_terminal", { mode: "boolean" }).notNull().default(false),
  // The Land of the business (ISO 3166-2 without "DE-"), the default for its sites (S-303)
  land: text("land"),
  // When the owner finished the setup; until then the app leads the owner there (S-303)
  eingerichtetAm: integer("eingerichtet_am"),
  // The settings the rules read (S-502); null keeps the default, never less strict than the law:
  // the industry of § 5 Abs. 2 ArbZG (BRANCHEN), the number of § 10 Abs. 1 ArbZG that allows work
  // on Sundays and holidays, and the Ausgleichszeitraum of § 3 Satz 2 ArbZG with its first day
  branche: text("branche"),
  sonntagsausnahme: integer("sonntagsausnahme"),
  ausgleichszeitraum: text("ausgleichszeitraum", { enum: ["sechs_monate", "24_wochen"] }),
  ausgleichBeginn: text("ausgleich_beginn"),
});

/**
 * What the rules need of a person and nothing more (S-502, docs/plan.md "Daten zur Person"): the
 * birth date (JArbSchG), Wechselschicht (§ 2 Abs. 5 Nr. 1 ArbZG), Arbeit auf Abruf (§ 12 TzBfG) and
 * the spans of the Mutterschutz as a JSON array of `{ von, bis }` (bis null while it lasts), which
 * say neither pregnant nor breastfeeding (Art. 9 DSGVO). Only the owner reads and writes them.
 */
export const personenangaben = sqliteTable(
  "personenangaben",
  {
    betriebId: text("betrieb_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    geburtsdatum: text("geburtsdatum"),
    wechselschicht: integer("wechselschicht", { mode: "boolean" }).notNull().default(false),
    abruf: integer("abruf", { mode: "boolean" }).notNull().default(false),
    mutterschutz: text("mutterschutz").notNull().default("[]"),
    geaendertAm: integer("geaendert_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.nutzerId] })],
);

/**
 * Where people work: the Land and the regional holidays of the municipality decide the holidays of
 * the site (S-105); a terminal stands at one (S-801)
 */
export const standorte = sqliteTable(
  "standorte",
  {
    betriebId: text("betrieb_id").notNull(),
    standortId: text("standort_id").notNull(),
    name: text("name").notNull(),
    adresse: text("adresse").notNull().default(""),
    land: text("land").notNull(),
    // JSON array of regions of packages/arbeitszeit (REGIONEN), e.g. ["augsburg"]
    regionen: text("regionen").notNull().default("[]"),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.standortId] })],
);

/**
 * A working-time model: the target minutes per weekday and the wage, in whole minutes and cents
 * (CLAUDE.md, "Never"). The wage is needed for the minimum wage, the mini-job limit and the tax-free
 * part of surcharges (docs/plan.md, "Datenmodell"); it may still be missing ("nicht hinterlegt").
 */
export const arbeitszeitmodelle = sqliteTable(
  "arbeitszeitmodelle",
  {
    betriebId: text("betrieb_id").notNull(),
    modellId: text("modell_id").notNull(),
    name: text("name").notNull(),
    // JSON array of seven whole minutes, Monday to Sunday
    sollMinuten: text("soll_minuten").notNull(),
    lohnArt: text("lohn_art", { enum: ["monat", "stunde"] }).notNull(),
    lohnCent: integer("lohn_cent"),
    minijob: integer("minijob", { mode: "boolean" }).notNull().default(false),
    gueltigAb: text("gueltig_ab").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.modellId] })],
);

/**
 * Which working-time model holds for a person from which day (S-304): the target of a day is the
 * model of the latest assignment on or before it; without one the target is "nicht hinterlegt"
 */
export const modellzuordnungen = sqliteTable(
  "modellzuordnungen",
  {
    betriebId: text("betrieb_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    gueltigAb: text("gueltig_ab").notNull(),
    modellId: text("modell_id").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.nutzerId, t.gueltigAb] })],
);

/**
 * A clock stamp, or a correction of one (S-304, docs/plan.md "Änderungen an Stempelungen"). Rows are
 * only appended: a change or a removal is a new row naming the row it replaces in `ersetzt`, with its
 * reason, so the original stays and the audit chain shows the history. A row is in force while no
 * other row replaces it and it is no removal. `zeitpunkt` is the server's clock for a live stamp
 * (the device's goes to `geraet_zeitpunkt`), the device's time moved by its clock's error for an
 * entry of the offline queue (`offline`, S-305), and the time entered for a correction. An entry of a
 * device's queue keeps the device, its running number and its signature, so a second copy is
 * recognised and a gap in the numbers shows.
 */
export const stempelungen = sqliteTable(
  "stempelungen",
  {
    betriebId: text("betrieb_id").notNull(),
    stempelId: text("stempel_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    art: text("art", { enum: ["kommen", "gehen", "pause_beginn", "pause_ende"] }).notNull(),
    zeitpunkt: integer("zeitpunkt").notNull(),
    geraetZeitpunkt: integer("geraet_zeitpunkt"),
    quelle: text("quelle", { enum: ["app", "terminal"] }).notNull(),
    ersetzt: text("ersetzt"),
    entfernt: integer("entfernt", { mode: "boolean" }).notNull().default(false),
    // required for every row a person entered by hand: an addition, a change, a removal
    grund: text("grund"),
    erstelltVon: text("erstellt_von").notNull(),
    erstelltAm: integer("erstellt_am").notNull(),
    // S-305: the device that signed the entry, its number there and the signature (base64url)
    geraetId: text("geraet_id"),
    nummer: integer("nummer"),
    signatur: text("signatur"),
    // stamped without a network: the instant comes from the device, `erstellt_am` is the receipt
    offline: integer("offline", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.stempelId] }),
    index("stempelungen_person").on(t.betriebId, t.nutzerId, t.zeitpunkt),
    // a row is replaced once; a second change replaces the newest version
    uniqueIndex("stempelungen_ersetzt").on(t.betriebId, t.ersetzt),
    // a number of a device is taken once (rows without a device have NULL and do not collide)
    uniqueIndex("stempelungen_geraet_nummer").on(t.betriebId, t.geraetId, t.nummer),
  ],
);

/**
 * The steps of closing a month of one person (S-306), only appended: the person confirms
 * (`bestaetigt`, again after a change), then the business closes (`abgeschlossen`, once per person
 * and month), which locks the month. `inhalt` is the month's content in canonical JSON
 * (modules/arbeitszeit/monatsinhalt.ts) and `inhalt_hash` its SHA-256; the link of the closing row
 * in the audit chain is the Prüfwert on the person's time sheet. `grund` says why the business
 * closed without a valid confirmation of the person. `sperrt` names the month a closing locks (null for
 * a confirmation), so a unique index lets a month close only once.
 */
export const monatsabschluesse = sqliteTable(
  "monatsabschluesse",
  {
    betriebId: text("betrieb_id").notNull(),
    abschlussId: text("abschluss_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    monat: text("monat").notNull(),
    schritt: text("schritt", { enum: ["bestaetigt", "abgeschlossen"] }).notNull(),
    inhalt: text("inhalt").notNull(),
    inhaltHash: text("inhalt_hash").notNull(),
    grund: text("grund"),
    sperrt: text("sperrt"),
    erstelltVon: text("erstellt_von").notNull(),
    erstelltAm: integer("erstellt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.abschlussId] }),
    index("monatsabschluesse_person").on(t.betriebId, t.nutzerId, t.monat),
    uniqueIndex("monatsabschluesse_einmal").on(t.betriebId, t.nutzerId, t.sperrt),
  ],
);

/**
 * A counter-entry to a day of a closed month (S-306, docs/plan.md "Änderungen an Stempelungen"):
 * whole minutes with a sign and a reason, only appended. It leaves the locked rows and the Prüfwert
 * as they are and is counted in the month it was entered in (`gebucht_in`).
 */
export const korrekturen = sqliteTable(
  "korrekturen",
  {
    betriebId: text("betrieb_id").notNull(),
    korrekturId: text("korrektur_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    tag: text("tag").notNull(),
    minuten: integer("minuten").notNull(),
    grund: text("grund").notNull(),
    gebuchtIn: text("gebucht_in").notNull(),
    erstelltVon: text("erstellt_von").notNull(),
    erstelltAm: integer("erstellt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.korrekturId] }),
    index("korrekturen_person").on(t.betriebId, t.nutzerId, t.tag),
  ],
);

/**
 * A device that stamps for one person: the public key of its non-extractable ECDSA P-256 key pair
 * (WebCrypto, JWK), with which the server checks every entry of its offline queue (S-305)
 */
export const geraete = sqliteTable(
  "geraete",
  {
    betriebId: text("betrieb_id").notNull(),
    geraetId: text("geraet_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    // the public key as JWK, canonical JSON of kty, crv, x and y
    schluessel: text("schluessel").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.geraetId] })],
);

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
 * Who belongs to a business in which role, mirrored from Better Auth's members by its hooks, so every
 * change of membership and role stands in the audit chain (CLAUDE.md, "Project specifics")
 */
export const mitgliedschaften = sqliteTable(
  "mitgliedschaften",
  {
    betriebId: text("betrieb_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    rolle: text("rolle").notNull(),
    seit: integer("seit").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.nutzerId] })],
);

/**
 * An invitation by link or QR code, without an e-mail address: only the hash of its token is kept,
 * the token itself is in the link (S-106)
 */
export const einladungen = sqliteTable(
  "einladungen",
  {
    betriebId: text("betrieb_id").notNull(),
    einladungId: text("einladung_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    rolle: text("rolle").notNull(),
    name: text("name").notNull(),
    erstelltVon: text("erstellt_von").notNull(),
    gueltigBis: integer("gueltig_bis").notNull(),
    angenommenVon: text("angenommen_von"),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.einladungId] })],
);

/** A person's PIN for the terminal, as a hash; locked after five wrong tries in a row */
export const pins = sqliteTable(
  "pins",
  {
    betriebId: text("betrieb_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    pinHash: text("pin_hash").notNull(),
    fehlversuche: integer("fehlversuche").notNull().default(0),
    gesperrt: integer("gesperrt", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.nutzerId] })],
);

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
