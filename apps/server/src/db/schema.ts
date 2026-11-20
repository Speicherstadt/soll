import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    gueltigAb: text("gueltig_ab").notNull(),
    angelegtAm: integer("angelegt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.modellId] })],
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
