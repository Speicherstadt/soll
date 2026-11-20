import { Database } from "bun:sqlite";
import { describe, expect, it } from "vitest";
import { migrationen } from "./migrationen.gen.ts";
import { migrieren } from "./migrieren.ts";
import { oeffneSqlite } from "./oeffnen.ts";
import { testDatenbank } from "./test-db.ts";

const tabellen = (sqlite: Database) =>
  sqlite
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    )
    .all()
    .map((zeile) => zeile.name);

describe("migrieren", () => {
  it("creates every table of the embedded migrations in WAL mode", () => {
    const { sqlite } = testDatenbank();
    expect(tabellen(sqlite)).toEqual(
      expect.arrayContaining([
        "audit_glieder",
        "audit_inhalte",
        "audit_koepfe",
        "betriebe",
        "soll_migrationen",
      ]),
    );
    expect(
      sqlite.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode,
    ).toBe("wal");
  });

  it("applies nothing the second time", () => {
    const { pfad, sqlite } = testDatenbank();
    sqlite.close();
    const wieder = oeffneSqlite(pfad);
    expect(migrieren(wieder, migrationen, 1)).toEqual([]);
    wieder.close();
  });

  it("refuses to start when an applied migration was changed", () => {
    const sqlite = new Database(":memory:");
    migrieren(sqlite, [{ tag: "0000_a", sql: "CREATE TABLE a (x INTEGER)" }], 0);
    expect(() =>
      migrieren(sqlite, [{ tag: "0000_a", sql: "CREATE TABLE a (y INTEGER)" }], 0),
    ).toThrow(/0000_a was changed/);
  });

  it("rolls a failing migration back as a whole", () => {
    const sqlite = new Database(":memory:");
    const kaputt = {
      tag: "0000_b",
      sql: "CREATE TABLE b (x INTEGER);\n--> statement-breakpoint\nKAPUTT",
    };
    expect(() => migrieren(sqlite, [kaputt], 0)).toThrow();
    expect(tabellen(sqlite)).not.toContain("b");
  });
});
