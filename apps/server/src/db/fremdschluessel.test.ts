import { Database } from "bun:sqlite";
import { describe, expect, it } from "vitest";
import { migrieren } from "./migrieren.ts";

describe("migrieren with foreign keys", () => {
  // drizzle-kit rebuilds a table to change a column (sqlite.org/lang_altertable.html, "Making Other
  // Kinds Of Table Schema Changes"): PRAGMA foreign_keys=OFF, new table, copy, DROP, RENAME. Inside a
  // transaction that PRAGMA is a no-op, so the DROP would cascade into the rows that reference it
  const umbau = {
    tag: "0001_umbau",
    sql: [
      "PRAGMA foreign_keys=OFF;",
      "CREATE TABLE `__new_eltern` (`id` text PRIMARY KEY NOT NULL, `name` text NOT NULL);",
      "INSERT INTO `__new_eltern`(`id`, `name`) SELECT `id`, coalesce(`name`, '') FROM `eltern`;",
      "DROP TABLE `eltern`;",
      "ALTER TABLE `__new_eltern` RENAME TO `eltern`;",
      "PRAGMA foreign_keys=ON;",
    ].join("\n--> statement-breakpoint\n"),
  };
  const anfang = {
    tag: "0000_anfang",
    sql: [
      "CREATE TABLE `eltern` (`id` text PRIMARY KEY NOT NULL, `name` text);",
      "CREATE TABLE `kinder` (`id` text PRIMARY KEY NOT NULL, `eltern_id` text NOT NULL REFERENCES `eltern`(`id`) ON DELETE CASCADE);",
    ].join("\n--> statement-breakpoint\n"),
  };

  const offen = () => {
    const sqlite = new Database(":memory:");
    sqlite.run("PRAGMA foreign_keys = ON");
    migrieren(sqlite, [anfang], 0);
    sqlite.run("INSERT INTO eltern VALUES ('a', 'A')");
    sqlite.run("INSERT INTO kinder VALUES ('k', 'a')");
    return sqlite;
  };

  it("keeps the rows that reference a rebuilt table", () => {
    const sqlite = offen();
    migrieren(sqlite, [anfang, umbau], 0);
    expect(sqlite.query("SELECT id, eltern_id FROM kinder").all()).toEqual([
      { id: "k", eltern_id: "a" },
    ]);
    expect(sqlite.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get()).toEqual({
      foreign_keys: 1,
    });
  });

  it("rolls a migration back that leaves a broken reference", () => {
    const sqlite = offen();
    const kaputt = { tag: "0001_kaputt", sql: "DELETE FROM eltern" };
    expect(() => migrieren(sqlite, [anfang, kaputt], 0)).toThrow(/foreign key/i);
    expect(sqlite.query("SELECT id FROM eltern").all()).toEqual([{ id: "a" }]);
    expect(sqlite.query("SELECT id FROM kinder").all()).toEqual([{ id: "k" }]);
  });
});
