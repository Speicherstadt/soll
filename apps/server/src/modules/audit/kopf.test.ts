import { describe, expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { kettePruefen, schreiben } from "./index.ts";

const weber = { betriebId: "weber", akteur: "jonas", jetzt: 1_790_000_000_000 };

/**
 * The head records the last link; a link cut off at the end shows only through it. If the next write
 * took its predecessor from the remaining links and moved the head on, that write would hide the cut.
 */
describe("a write after a link was cut off at the end", () => {
  it("keeps the cut visible in the check", () => {
    const { db, sqlite } = testDatenbank();
    schreiben(db, weber, (s) =>
      s.einfuegen("betriebe", { betriebId: "weber", name: "Weber", angelegtAm: 1 }),
    );
    schreiben(db, weber, (s) =>
      s.aendern("betriebe", { betriebId: "weber" }, { name: "Weber Haustechnik" }),
    );
    // Past the chain: drop the last link with its content and undo its change
    sqlite.run("DELETE FROM audit_glieder WHERE seq = 2");
    sqlite.run("DELETE FROM audit_inhalte WHERE seq = 2");
    sqlite.run("UPDATE betriebe SET name = 'Weber'");
    expect(kettePruefen(db, "weber")).toEqual([{ art: "kopf", grund: "abweichend" }]);

    schreiben(db, weber, (s) =>
      s.aendern("betriebe", { betriebId: "weber" }, { name: "Weber Haustechnik GmbH" }),
    );
    expect(kettePruefen(db, "weber")).not.toEqual([]);
  });
});
