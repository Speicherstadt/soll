import { describe, expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { kettePruefen, schreiben } from "./index.ts";

const weber = { betriebId: "weber", akteur: "jonas", jetzt: 1_790_000_000_000 };

/** Weber Haustechnik renamed once, with a second business beside it */
const mitZweiBetrieben = () => {
  const t = testDatenbank();
  for (const kontext of [weber, { ...weber, betriebId: "elbblick" }]) {
    schreiben(t.schreibDb, kontext, (s) =>
      s.einfuegen("betriebe", { betriebId: kontext.betriebId, name: "alt", angelegtAm: 1 }),
    );
  }
  schreiben(t.schreibDb, weber, (s) =>
    s.aendern("betriebe", { betriebId: "weber" }, { name: "Weber Haustechnik" }),
  );
  return t;
};

const inhalte = (sqlite: ReturnType<typeof testDatenbank>["sqlite"], betriebId: string) =>
  sqlite.query("SELECT seq FROM audit_inhalte WHERE betrieb_id = ? ORDER BY seq").all(betriebId);

describe("removing the stored contents of a row's links", () => {
  it("removes the contents of that row so far, keeps its links, and the chain verifies", () => {
    const { db, sqlite, schreibDb } = mitZweiBetrieben();
    const entfernt = schreiben(schreibDb, weber, (s) =>
      s.inhalteEntfernen("betriebe", { betriebId: "weber" }, { name: "Weber Haustechnik GmbH" }),
    );
    expect(entfernt.inhalte).toBe(2);
    expect(inhalte(sqlite, "weber")).toEqual([{ seq: 3 }]);
    expect(
      sqlite.query("SELECT COUNT(*) AS n FROM audit_glieder WHERE betrieb_id = 'weber'").get(),
    ).toEqual({ n: 3 });
    expect(inhalte(sqlite, "elbblick")).toEqual([{ seq: 1 }]);
    expect(kettePruefen(db, "weber")).toEqual([]);
  });

  it("reaches no other business's row", () => {
    const { sqlite, schreibDb } = mitZweiBetrieben();
    expect(() =>
      schreiben(schreibDb, weber, (s) =>
        s.inhalteEntfernen("betriebe", { betriebId: "elbblick" }, { name: "x" }),
      ),
    ).toThrow();
    expect(inhalte(sqlite, "elbblick")).toEqual([{ seq: 1 }]);
  });

  it("never removes contents without a link of its own: it is a change of the row", () => {
    const { db, sqlite, schreibDb } = mitZweiBetrieben();
    const glieder = () =>
      sqlite.query("SELECT COUNT(*) AS n FROM audit_glieder WHERE betrieb_id = 'weber'").get();
    expect(glieder()).toEqual({ n: 2 });
    schreiben(schreibDb, weber, (s) =>
      s.inhalteEntfernen("betriebe", { betriebId: "weber" }, { name: "Weber" }),
    );
    expect(glieder()).toEqual({ n: 3 });
    expect(kettePruefen(db, "weber")).toEqual([]);
  });

  it("refuses a row named without its whole key", () => {
    const { schreibDb } = mitZweiBetrieben();
    expect(() =>
      schreiben(schreibDb, weber, (s) =>
        s.inhalteEntfernen("modellzuordnungen", { nutzerId: "x" }, {}),
      ),
    ).toThrow(/key gueltigAb missing/);
  });
});
