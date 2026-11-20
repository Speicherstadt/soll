import type { Database } from "bun:sqlite";
import { sha256 } from "../modules/audit/hash.ts";

export type Migration = { tag: string; sql: string };

/** drizzle-kit separates the statements of a migration with this line */
const GRENZE = "--> statement-breakpoint";

/**
 * Applies the embedded migrations that are not yet in the database, each in its own transaction.
 * A migration that was applied with other content, or that the binary no longer holds (removed, or an
 * older binary on a newer database), stops the start: migrations never change (CLAUDE.md). The bookkeeping table is the server's own and outside the audit chain.
 */
export const migrieren = (
  sqlite: Database,
  migrationen: readonly Migration[],
  jetzt: number,
): string[] => {
  sqlite.run(
    "CREATE TABLE IF NOT EXISTS soll_migrationen (tag TEXT PRIMARY KEY, hash TEXT NOT NULL, angewendet_am INTEGER NOT NULL)",
  );
  const angewendet = new Map(
    sqlite
      .query<{ tag: string; hash: string }, []>("SELECT tag, hash FROM soll_migrationen")
      .all()
      .map((zeile) => [zeile.tag, zeile.hash]),
  );
  const bekannt = new Set(migrationen.map((migration) => migration.tag));
  const unbekannt = [...angewendet.keys()].filter((tag) => !bekannt.has(tag));
  if (unbekannt.length > 0) {
    throw new Error(
      `migration ${unbekannt.join(", ")} was applied but is missing from this binary`,
    );
  }
  const neu = migrationen.filter((migration) => {
    const hash = angewendet.get(migration.tag);
    if (hash !== undefined && hash !== sha256(migration.sql)) {
      throw new Error(`migration ${migration.tag} was changed after it was applied`);
    }
    return hash === undefined;
  });
  if (neu.length === 0) return [];
  // PRAGMA foreign_keys is a no-op inside a transaction, so the one drizzle-kit writes before it
  // rebuilds a table would not stop the DROP from cascading into the rows that reference it; foreign
  // keys go off around the migrations and are checked before each commit instead
  // (sqlite.org/lang_altertable.html, "Making Other Kinds Of Table Schema Changes", steps 1, 10, 12)
  const fremdschluessel =
    sqlite.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get()?.foreign_keys ?? 0;
  sqlite.run("PRAGMA foreign_keys = OFF");
  try {
    for (const migration of neu) anwenden(sqlite, migration, jetzt);
  } finally {
    sqlite.run(`PRAGMA foreign_keys = ${fremdschluessel ? "ON" : "OFF"}`);
  }
  return neu.map((migration) => migration.tag);
};

const anwenden = (sqlite: Database, migration: Migration, jetzt: number): void => {
  sqlite.transaction(() => {
    for (const statement of migration.sql.split(GRENZE)) {
      if (statement.trim() !== "") sqlite.run(statement);
    }
    const verletzt = sqlite.query("PRAGMA foreign_key_check").all();
    if (verletzt.length > 0) {
      throw new Error(`migration ${migration.tag} breaks ${verletzt.length} foreign key(s)`);
    }
    sqlite
      .query("INSERT INTO soll_migrationen (tag, hash, angewendet_am) VALUES (?, ?, ?)")
      .run(migration.tag, sha256(migration.sql), jetzt);
  })();
};
