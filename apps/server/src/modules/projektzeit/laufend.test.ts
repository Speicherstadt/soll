import { describe, expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { schreiben } from "../audit/index.ts";

/** The database itself keeps one running booking per person (S-602), whatever the code above it does */
describe("the partial unique index projektzeiten_laeuft", () => {
  const zeile = (buchungId: string, nutzerId: string, ende: number | null) => ({
    betriebId: "weber",
    buchungId,
    nutzerId,
    projektId: null,
    taetigkeitId: "fahrt",
    beginn: 0,
    ende,
    tag: "1970-01-01",
    angelegtAm: 0,
  });

  it("refuses a second running booking of the same person, not a finished one or another's", () => {
    const { schreibDb } = testDatenbank();
    const kontext = { betriebId: "weber", akteur: "sandra", jetzt: 0 };
    schreiben(schreibDb, kontext, (s) => {
      s.einfuegen("projektzeiten", zeile("a", "sandra", null));
      s.einfuegen("projektzeiten", zeile("b", "sandra", 60_000));
      s.einfuegen("projektzeiten", zeile("c", "max", null));
    });
    expect(() =>
      schreiben(schreibDb, kontext, (s) =>
        s.einfuegen("projektzeiten", zeile("d", "sandra", null)),
      ),
    ).toThrow(/UNIQUE constraint failed/);
  });
});
