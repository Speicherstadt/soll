import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/* The imports from other tools (S-701); re-exported by ../schema.ts */

/**
 * One import taken over, only appended (docs/plan.md, "Datenmodell"): the tool (`quelle`, the id in
 * packages/import, also `extern_quelle` of every row it brought), the original file by its SHA-256 in
 * the content-addressed store with its name and size, the mapping the owner chose and what came of
 * it, both as canonical JSON, the month up to which the old tool had closed the months, who and
 * when. The rows it wrote carry `import_id`.
 */
export const importe = sqliteTable(
  "importe",
  {
    betriebId: text("betrieb_id").notNull(),
    importId: text("import_id").notNull(),
    quelle: text("quelle").notNull(),
    dateiSha256: text("datei_sha256").notNull(),
    dateiName: text("datei_name").notNull(),
    dateiBytes: integer("datei_bytes").notNull(),
    zuordnung: text("zuordnung").notNull(),
    abgeschlossenBis: text("abgeschlossen_bis"),
    zahlen: text("zahlen").notNull(),
    erstelltVon: text("erstellt_von").notNull(),
    erstelltAm: integer("erstellt_am").notNull(),
  },
  (t) => [primaryKey({ columns: [t.betriebId, t.importId] })],
);
