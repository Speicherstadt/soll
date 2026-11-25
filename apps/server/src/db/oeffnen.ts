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

declare const schreibMarke: unique symbol;

/**
 * The one writable connection, handed only to `schreiben` in src/modules/audit: everything else
 * reads through `db`, a connection SQLite opens read-only, so a write past the audit chain fails at
 * run time, not only in the static test (BAULISTE.md S-102).
 */
export type SchreibDb = { readonly verbindung: Db; readonly [schreibMarke]: true };

export type Datenbank = {
  /** Read-only: every query of the modules goes here */
  db: Db;
  /** For `schreiben` alone */
  schreibDb: SchreibDb;
  /** The writable connection itself, for the migrator and for tests that tamper on purpose */
  sqlite: Database;
  schliessen: () => void;
};

/**
 * Opens the database at `pfad`, applies the embedded migrations and returns a read-only connection
 * for the modules and the writable one for the audit chain
 */
export const oeffneDatenbank = (pfad: string, jetzt: number): Datenbank => {
  const sqlite = oeffneSqlite(pfad);
  migrieren(sqlite, migrationen, jetzt);
  const lesend = new Database(pfad, { readonly: true, strict: true });
  lesend.run("PRAGMA busy_timeout = 5000");
  // A read-only connection still writes TEMP tables, and one named like a table of Soll would shadow
  // it for every read; query_only refuses those too (sqlite.org/pragma.html#pragma_query_only)
  lesend.run("PRAGMA query_only = ON");
  return {
    db: alsDrizzle(lesend),
    schreibDb: { verbindung: alsDrizzle(sqlite) } as SchreibDb,
    sqlite,
    schliessen: () => {
      lesend.close();
      sqlite.close();
    },
  };
};

/**
 * Opens an existing database read-only, without migrating, for a check from outside the server (the
 * load test, S-904): it reads while the server writes in WAL mode and can change nothing
 */
export const nurLesendOeffnen = (pfad: string): { db: Db; schliessen: () => void } => {
  const lesend = new Database(pfad, { readonly: true, strict: true });
  lesend.run("PRAGMA busy_timeout = 5000");
  lesend.run("PRAGMA query_only = ON");
  return { db: alsDrizzle(lesend), schliessen: () => lesend.close() };
};

/** What a file holds, before it is copied or restored */
export type Bestand = "soll" | "fremd" | "kaputt";

/**
 * Looks at an existing file read-only: a database SQLite finds intact (`PRAGMA integrity_check`) with
 * the migrations' bookkeeping table is Soll's; one without it is another app's (S-905)
 */
export const bestandPruefen = (pfad: string): Bestand => {
  try {
    const lesend = new Database(pfad, { readonly: true, strict: true });
    try {
      const pruefung = lesend
        .query<{ integrity_check: string }, []>("PRAGMA integrity_check")
        .all();
      if (pruefung.length !== 1 || pruefung[0]?.integrity_check !== "ok") return "kaputt";
      const buchhaltung = lesend
        .query("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'soll_migrationen'")
        .get();
      return buchhaltung ? "soll" : "fremd";
    } finally {
      lesend.close();
    }
  } catch {
    return "kaputt";
  }
};

/**
 * Copies the database at `quelle` into the new file `ziel` with `VACUUM INTO`, over a read-only
 * connection: SQLite writes a consistent snapshot of what was committed, including what still lies
 * in the WAL, while the server goes on writing (sqlite.org/lang_vacuum.html#vacuuminto). The copy
 * is one file without a WAL beside it. Nothing of Soll's database is written, so the audit chain is
 * not involved.
 */
export const datenbankKopieren = (quelle: string, ziel: string): void => {
  const lesend = new Database(quelle, { readonly: true, strict: true });
  try {
    lesend.run("PRAGMA busy_timeout = 5000");
    lesend.run("VACUUM INTO ?", [ziel]);
  } finally {
    lesend.close();
  }
};
