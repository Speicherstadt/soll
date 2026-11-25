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

export * from "./schema/abwesenheiten.ts";
export * from "./schema/datev.ts";
export * from "./schema/dienstplan.ts";
export * from "./schema/erinnerungen.ts";
export * from "./schema/haben.ts";
export * from "./schema/personenangaben.ts";
export * from "./schema/projektzeit.ts";
export * from "./schema/stundennachweise.ts";
export * from "./schema/terminal.ts";
export * from "./schema/zugaenge.ts";

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
  // From which day of a sickness the business wants the certificate: 4 by law, earlier if it asks
  // (§ 5 Abs. 1 Satz 2 and 3 EntgFG, S-401)
  bescheinigungAbTag: integer("bescheinigung_ab_tag").notNull().default(4),
  // When Soll switched working time on because the first employed person joined; the owner sees the
  // reason until confirming it, then it is empty again (S-603)
  pflichtHinweisAm: integer("pflicht_hinweis_am"),
  // Since when the owner switched on the utilisation per person; null: off, only the team view
  // (S-604, § 87 Abs. 1 Nr. 6 BetrVG). Each switch stands in the audit chain with actor and time.
  auswertungJePersonSeit: integer("auswertung_je_person_seit"),
});

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
    // JSON object of the surcharges the model pays, in basis points (`Zuschlagssaetze`, S-207/S-308)
    zuschlagssaetze: text("zuschlagssaetze").notNull().default("{}"),
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
    art: text("art", {
      enum: ["kommen", "gehen", "pause_beginn", "pause_ende"],
    }).notNull(),
    zeitpunkt: integer("zeitpunkt").notNull(),
    geraetZeitpunkt: integer("geraet_zeitpunkt"),
    // "api": stamped with a personal access token (S-607)
    quelle: text("quelle", { enum: ["app", "terminal", "api"] }).notNull(),
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
    // S-801: the terminal a person stamped at, with the PIN or the QR code
    terminalId: text("terminal_id"),
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
    schritt: text("schritt", {
      enum: ["bestaetigt", "abgeschlossen"],
    }).notNull(),
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

/**
 * A person's PIN for the terminal, as a hash; locked after five wrong tries in a row. `pin_kennung`
 * is a keyed hash (HMAC-SHA-256 with a key derived from SOLL_SECRET_KEY) by which the terminal finds
 * the person from the PIN alone (S-801), so a PIN is unique in its business; a PIN set before S-801
 * has none until the owner sets it again.
 */
export const pins = sqliteTable(
  "pins",
  {
    betriebId: text("betrieb_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    pinHash: text("pin_hash").notNull(),
    fehlversuche: integer("fehlversuche").notNull().default(0),
    gesperrt: integer("gesperrt", { mode: "boolean" }).notNull().default(false),
    pinKennung: text("pin_kennung"),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.nutzerId] }),
    uniqueIndex("pins_kennung").on(t.betriebId, t.pinKennung),
  ],
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
    aktion: text("aktion", {
      enum: ["einfuegen", "aendern", "loeschen"],
    }).notNull(),
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
