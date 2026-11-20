import { describe, expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { kettePruefen, schreiben } from "./index.ts";

const weber = { betriebId: "weber", akteur: "jonas", jetzt: 1_790_000_000_000 };

/** A write that fails must leave nothing behind, even when `arbeit` catches its error and goes on */
describe("schreiben with a failed write that arbeit catches", () => {
  it("keeps the row of a write whose link could not be appended out of the database", () => {
    const { db, sqlite } = testDatenbank();
    schreiben(db, weber, (s) => {
      try {
        s.einfuegen("betriebe", { betriebId: "weber", name: "Weber", angelegtAm: 1.5 });
      } catch {
        // the caller handles the error and carries on
      }
    });
    expect(sqlite.query("SELECT count(*) AS n FROM betriebe").get()).toEqual({ n: 0 });
    expect(kettePruefen(db, "weber")).toEqual([]);
  });

  it("keeps the change of a failed update out of the database", () => {
    const { db, sqlite } = testDatenbank();
    schreiben(db, weber, (s) =>
      s.einfuegen("betriebe", { betriebId: "weber", name: "Weber", angelegtAm: 1 }),
    );
    schreiben(db, weber, (s) => {
      try {
        s.aendern("betriebe", { betriebId: "weber" }, { angelegtAm: 2.5 });
      } catch {
        // handled
      }
      s.aendern("betriebe", { betriebId: "weber" }, { name: "Weber Haustechnik" });
    });
    expect(sqlite.query("SELECT angelegt_am AS a FROM betriebe").get()).toEqual({ a: 1 });
    expect(kettePruefen(db, "weber")).toEqual([]);
  });
});
