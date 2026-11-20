import { describe, expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { kettePruefen, schreiben } from "./index.ts";

/**
 * SQLite stores text as UTF-8, so a lone surrogate in a string comes back as U+FFFD. A link hashed
 * over the string as given would then fail its own check, and a Prüfwert a person holds would show a
 * deviation nobody made; such a context is refused before anything is written.
 */
describe("schreiben with a string SQLite cannot store as given", () => {
  it.each([
    ["akteur", { betriebId: "weber", akteur: "jonas\uD800", jetzt: 1_790_000_000_000 }],
    ["betriebId", { betriebId: "weber\uDC00", akteur: "jonas", jetzt: 1_790_000_000_000 }],
  ])("refuses a lone surrogate in %s and writes nothing", (_feld, kontext) => {
    const { db, sqlite } = testDatenbank();
    expect(() =>
      schreiben(db, kontext, (s) =>
        s.einfuegen("betriebe", { betriebId: kontext.betriebId, name: "Weber", angelegtAm: 1 }),
      ),
    ).toThrow(/well-formed/);
    expect(sqlite.query("SELECT count(*) AS n FROM audit_glieder").get()).toEqual({ n: 0 });
    expect(sqlite.query("SELECT count(*) AS n FROM betriebe").get()).toEqual({ n: 0 });
    expect(kettePruefen(db, kontext.betriebId)).toEqual([]);
  });
});
