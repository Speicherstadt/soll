import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { getTableColumns, getTableName } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import * as schema from "../../db/schema.ts";
import { kettenTabellen } from "./tabellen.ts";

const SRC = join(import.meta.dirname, "../..");

/** The only files that may write: the chain itself, and the migrations on their own bookkeeping table */
const ERLAUBT = new Set(["modules/audit/schreiben.ts", "db/migrieren.ts", "db/oeffnen.ts"]);

const TABELLEN = Object.keys(schema).join("|");

/**
 * The ways to write: Drizzle's insert, update and delete on a table of the schema, raw SQL that writes,
 * Drizzle's `sql` template, and bun:sqlite itself (whoever holds a Database can run anything)
 */
const SCHREIBEN = [
  new RegExp(`\\.(insert|update|delete)\\s*\\(\\s*(schema\\.)?(${TABELLEN})\\b`),
  /\b(INSERT\s+(OR\s+\w+\s+)?INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|REPLACE\s+INTO|DROP\s+TABLE|ALTER\s+TABLE)\b/i,
  /\bsql\s*`/,
  /from\s+["']bun:sqlite["']/,
];

const quellen = (ordner: string): string[] =>
  readdirSync(ordner, { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = join(ordner, eintrag.name);
    if (eintrag.isDirectory()) return quellen(pfad);
    return /\.tsx?$/.test(eintrag.name) &&
      !/\.test\.tsx?$/.test(eintrag.name) &&
      !eintrag.name.endsWith(".gen.ts")
      ? [pfad]
      : [];
  });

describe("no write past the audit chain", () => {
  it("only the chain's own files call a write function", () => {
    const umwege = quellen(SRC)
      .map((pfad) => relative(SRC, pfad))
      .filter((datei) => !ERLAUBT.has(datei))
      .flatMap((datei) =>
        readFileSync(join(SRC, datei), "utf8")
          .split("\n")
          .flatMap((zeile, index) =>
            SCHREIBEN.some((muster) => muster.test(zeile))
              ? [`${datei}:${index + 1}: ${zeile.trim()}`]
              : [],
          ),
      );
    expect(umwege).toEqual([]);
  });

  it("every table of Soll with betrieb_id goes through the chain", () => {
    const eigene = Object.values(schema as Record<string, unknown>)
      .filter((wert): wert is SQLiteTable => wert instanceof SQLiteTable)
      .filter((tabelle) => !getTableName(tabelle).startsWith("audit_"))
      .filter((tabelle) => "betriebId" in getTableColumns(tabelle))
      .map(getTableName);
    const angemeldet = Object.values(kettenTabellen).map(({ tabelle }) => getTableName(tabelle));
    expect(eigene.sort()).toEqual(angemeldet.sort());
  });

  it("every table of Soll carries betrieb_id", () => {
    const ohne = Object.values(schema as Record<string, unknown>)
      .filter((wert): wert is SQLiteTable => wert instanceof SQLiteTable)
      .filter((tabelle) => !("betriebId" in getTableColumns(tabelle)))
      .map(getTableName);
    expect(ohne).toEqual([]);
  });
});
