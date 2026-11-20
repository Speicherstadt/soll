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
  for (const migration of neu) {
    sqlite.transaction(() => {
      for (const statement of migration.sql.split(GRENZE)) {
        if (statement.trim() !== "") sqlite.run(statement);
      }
      sqlite
        .query("INSERT INTO soll_migrationen (tag, hash, angewendet_am) VALUES (?, ?, ?)")
        .run(migration.tag, sha256(migration.sql), jetzt);
    })();
  }
  return neu.map((migration) => migration.tag);
};
