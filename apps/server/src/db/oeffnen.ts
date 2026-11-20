import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrationen } from "./migrationen.gen.ts";
import { migrieren } from "./migrieren.ts";
import * as schema from "./schema.ts";

export const oeffneSqlite = (pfad: string): Database => {
  const sqlite = new Database(pfad, { create: true, strict: true });
  // WAL: readers do not wait for the writer (docs/plan.md, "Technologie")
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run("PRAGMA busy_timeout = 5000");
  return sqlite;
};

export const alsDrizzle = (sqlite: Database) => drizzle(sqlite, { schema });

export type Db = ReturnType<typeof alsDrizzle>;

/** Opens the database at `pfad`, applies the embedded migrations and returns it for Drizzle */
export const oeffneDatenbank = (pfad: string, jetzt: number): { db: Db; sqlite: Database } => {
  const sqlite = oeffneSqlite(pfad);
  migrieren(sqlite, migrationen, jetzt);
  return { db: alsDrizzle(sqlite), sqlite };
};
