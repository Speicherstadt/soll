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
 * The ways to write: Drizzle's insert, update and delete on a table of the schema (under any namespace
 * name), raw SQL that writes,
 * Drizzle's `sql` template and `sql.raw`, the chained tables as `kettenTabellen` exports them, and
 * bun:sqlite itself, also as Drizzle's `$client` (whoever holds a Database can run anything), and
 * the writable connection oeffneDatenbank hands out as `sqlite` and `SchreibDb.verbindung`, and the
 * pragmas and DDL that lift the read-only connection or shadow a table (Drizzle's run takes a string)
 */
const SCHREIBEN = [
  new RegExp(`\\.(insert|update|delete)\\s*\\(\\s*(\\w+\\.)?(${TABELLEN})\\b`),
  /\.(insert|update|delete)\s*\(\s*kettenTabellen\b/,
  /\$client\b/,
  /\bsql\.raw\s*\(/,
  /\b(INSERT\s+(OR\s+\w+\s+)?INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|REPLACE\s+INTO|DROP\s+TABLE|ALTER\s+TABLE)\b/i,
  /\bsql\s*`/,
  /from\s+["']bun:sqlite["']/,
  /(?<![\w/-])(sqlite|verbindung)(?![\w-])/,
  /\bPRAGMA\b/i,
  /\bCREATE\s+(\w+\s+)*(TABLE|VIEW|TRIGGER|INDEX)\b/i,
  /\bATTACH\s+(DATABASE\s+)?["'`$]/i,
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

/**
 * Drizzle's write builders by what follows them, on any table expression (a renamed import, a
 * destructured `tabelle`) and across lines, as the formatter breaks long chains
 */
const BAUSTEIN =
  /\.\s*(insert\s*\([^;]*?\)\s*\.\s*(values|select)|update\s*\([^;]*?\)\s*\.\s*set|delete\s*\([^;]*?\)\s*\.\s*(where|run|returning|all|get|execute))\s*\(/g;

/** The line numbers (from 0) where a write builder starts */
const bausteinZeilen = (text: string): Set<number> =>
  new Set(
    [...text.matchAll(BAUSTEIN)].map(
      (treffer) => text.slice(0, treffer.index).split("\n").length - 1,
    ),
  );

/** The lines of one file that write */
const umwegeIn = (datei: string, text: string): string[] => {
  const bausteine = bausteinZeilen(text);
  return text
    .split("\n")
    .flatMap((zeile, index) =>
      bausteine.has(index) || SCHREIBEN.some((muster) => muster.test(zeile))
        ? [`${datei}:${index + 1}: ${zeile.trim()}`]
        : [],
    );
};

describe("no write past the audit chain", () => {
  it("only the chain's own files call a write function", () => {
    const umwege = quellen(SRC)
      .map((pfad) => relative(SRC, pfad))
      .filter((datei) => !ERLAUBT.has(datei))
      .flatMap((datei) => umwegeIn(datei, readFileSync(join(SRC, datei), "utf8")));
    expect(umwege).toEqual([]);
  });

  it("recognises a write through the chained tables the audit module exports, or the raw client", () => {
    const umwege = [
      "db.insert(kettenTabellen.betriebe.tabelle).values(werte).run();",
      "tx.update(kettenTabellen[name].tabelle).set(neu).run();",
      "db.$client.run(befehl);",
      "db.run(sql.raw(befehl));",
    ].flatMap((zeile) => umwegeIn("x.ts", zeile));
    expect(umwege).toHaveLength(4);
  });

  it("recognises a write through the writable connection oeffneDatenbank hands out", () => {
    // Datenbank.sqlite is a writable bun:sqlite Database and SchreibDb.verbindung a writable Drizzle
    // connection: whoever reaches either can run anything, past the chain and past the read-only db
    const umwege = [
      "offen.sqlite.run(befehl);",
      "const { sqlite } = oeffneDatenbank(pfad, jetzt);",
      "schreibDb.verbindung.run(anweisung);",
    ].flatMap((zeile) => umwegeIn("x.ts", zeile));
    expect(umwege).toHaveLength(3);
  });

  it("recognises a pragma or DDL that lifts the read-only connection or shadows a table", () => {
    // Drizzle's db.run takes a plain string: PRAGMA query_only = OFF lifts what oeffnen.ts set, and a
    // TEMP table named like a table of Soll then shadows it for every read, with rows that never
    // passed the chain and no INSERT anywhere
    const umwege = [
      'db.run("PRAGMA query_only = OFF");',
      "db.run(\"CREATE TEMP TABLE betriebe AS SELECT 'weber' AS betrieb_id\");",
      'db.run("create temporary view betriebe as select 1");',
      "db.run(\"ATTACH DATABASE 'x.db' AS x\");",
    ].flatMap((zeile) => umwegeIn("x.ts", zeile));
    expect(umwege).toHaveLength(4);
  });

  it("recognises a write to a table of the schema imported under another name", () => {
    // `import * as tabellen from "../db/schema.ts"` is as common as `import * as schema`
    const umwege = ["db.insert(tabellen.betriebe).values(werte).run();"].flatMap((zeile) =>
      umwegeIn("x.ts", zeile),
    );
    expect(umwege).toHaveLength(1);
  });

  it("recognises a write to a table held under any name, also across lines", () => {
    // pruefen.ts itself takes `const { tabelle } = kettenTabellen[name]`; a named import can rename a table
    const dateien = [
      "const { tabelle } = kettenTabellen.betriebe;\ndb.delete(tabelle).where(bedingung).run();",
      'import { betriebe as firmen } from "../../db/schema.ts";\ndb.insert(firmen).values(werte).run();',
      "const { tabelle } = kettenTabellen.betriebe;\ntx\n  .update(tabelle)\n  .set(neu)\n  .run();",
    ];
    expect(dateien.map((text) => umwegeIn("x.ts", text).length)).toEqual([1, 1, 1]);
  });

  it("does not mistake a hash or a Map for a write", () => {
    const text = 'createHash("sha256").update(text, "utf8").digest("hex");\ngesehen.delete(id);';
    expect(umwegeIn("x.ts", text)).toEqual([]);
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
