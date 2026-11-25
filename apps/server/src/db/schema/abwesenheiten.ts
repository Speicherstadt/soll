import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* The table of absences (S-401); re-exported by ../schema.ts */

/**
 * An absence of a person from `von` to `bis`, both included (S-401): leave and the other kinds a
 * request asks for are `beantragt` until the business approves or refuses them, the person may
 * withdraw a request, and the business cancels approved leave only with a reason; a sickness is
 * reported and counts at once, `bis` stays open until its end is known. The first and the last day
 * may be half. Of a sickness Soll keeps only that a certificate is there (eAU or paper in the
 * office), never a diagnosis or a file (Art. 9 DSGVO); of a child only a short id (§ 45 SGB V).
 * `grund` is the reason of a refusal or a cancellation.
 */
export const abwesenheiten = sqliteTable(
  "abwesenheiten",
  {
    betriebId: text("betrieb_id").notNull(),
    abwesenheitId: text("abwesenheit_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    art: text("art", {
      enum: ["urlaub", "krank", "kind_krank", "sonderurlaub", "ueberstundenabbau"],
    }).notNull(),
    von: text("von").notNull(),
    bis: text("bis"),
    ersterHalb: integer("erster_halb", { mode: "boolean" }).notNull().default(false),
    letzterHalb: integer("letzter_halb", { mode: "boolean" }).notNull().default(false),
    status: text("status", {
      enum: ["beantragt", "genehmigt", "abgelehnt", "zurueckgezogen", "storniert"],
    }).notNull(),
    kind: text("kind"),
    bescheinigung: text("bescheinigung", { enum: ["eau", "papier"] }),
    grund: text("grund"),
    entschiedenVon: text("entschieden_von"),
    entschiedenAm: integer("entschieden_am"),
    erstelltVon: text("erstellt_von").notNull(),
    erstelltAm: integer("erstellt_am").notNull(),
    // S-701: the import it was taken over in, the tool and its id there, once per business
    importId: text("import_id"),
    externQuelle: text("extern_quelle"),
    externId: text("extern_id"),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.abwesenheitId] }),
    index("abwesenheiten_person").on(t.betriebId, t.nutzerId, t.von),
    uniqueIndex("abwesenheiten_extern").on(t.betriebId, t.externQuelle, t.externId),
  ],
);
