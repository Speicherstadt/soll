import { describe, expect, it } from "vitest";
import { nurLesendOeffnen } from "./oeffnen.ts";
import { betriebe } from "./schema.ts";
import { testDatenbank } from "./test-db.ts";

describe("the connection the modules get", () => {
  it("refuses every write, so nothing reaches Soll's tables past the audit chain", () => {
    const { db } = testDatenbank();
    expect(() =>
      db.insert(betriebe).values({ betriebId: "weber", name: "Weber", angelegtAm: 1 }).run(),
    ).toThrow(/readonly/i);
    expect(() => db.$client.run("DELETE FROM betriebe")).toThrow(/readonly/i);
  });

  it("refuses a temporary table that would hide a table of Soll from every read", () => {
    // A read-only connection still writes TEMP tables; one named like a table of Soll shadows it, and
    // Drizzle's insert then succeeds and every select returns rows that never passed the chain
    const { db, schreibDb } = testDatenbank();
    expect(() =>
      db.$client.run("CREATE TEMP TABLE betriebe AS SELECT * FROM main.betriebe"),
    ).toThrow(/readonly/i);
    expect(() =>
      db.insert(betriebe).values({ betriebId: "weber", name: "Weber", angelegtAm: 1 }).run(),
    ).toThrow(/readonly/i);
    expect(schreibDb.verbindung.select().from(betriebe).all()).toEqual([]);
    expect(db.select().from(betriebe).all()).toEqual([]);
  });

  it("sees what the chain wrote", async () => {
    const { db, schreibDb } = testDatenbank();
    const { schreiben } = await import("../modules/audit/index.ts");
    schreiben(schreibDb, { betriebId: "weber", akteur: "jonas", jetzt: 1 }, (s) =>
      s.einfuegen("betriebe", { betriebId: "weber", name: "Weber", angelegtAm: 1 }),
    );
    expect(db.select().from(betriebe).all()).toEqual([
      expect.objectContaining({ betriebId: "weber", name: "Weber", angelegtAm: 1 }),
    ]);
  });
});

describe("a database opened read-only from outside the server (S-904)", () => {
  it("sees what the server's connection wrote and refuses every write", async () => {
    const { schreibDb, pfad } = testDatenbank();
    const { schreiben } = await import("../modules/audit/index.ts");
    schreiben(schreibDb, { betriebId: "weber", akteur: "jonas", jetzt: 1 }, (s) =>
      s.einfuegen("betriebe", { betriebId: "weber", name: "Weber", angelegtAm: 1 }),
    );
    const { db, schliessen } = nurLesendOeffnen(pfad);
    try {
      expect(db.select({ name: betriebe.name }).from(betriebe).all()).toEqual([{ name: "Weber" }]);
      expect(() =>
        db.insert(betriebe).values({ betriebId: "elbblick", name: "Café", angelegtAm: 1 }).run(),
      ).toThrow(/readonly/i);
    } finally {
      schliessen();
    }
  });
});
