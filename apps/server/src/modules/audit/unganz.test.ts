import { describe, expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { aktuellerPruefwert, kettePruefen, pruefwertPruefen, schreiben } from "./index.ts";

const weber = { betriebId: "weber", akteur: "jonas", jetzt: 1_790_000_000_000 };

const mitZweiGliedern = () => {
  const t = testDatenbank();
  schreiben(t.db, weber, (s) =>
    s.einfuegen("betriebe", { betriebId: "weber", name: "Weber", angelegtAm: 1 }),
  );
  schreiben(t.db, weber, (s) =>
    s.aendern("betriebe", { betriebId: "weber" }, { name: "Weber Haustechnik" }),
  );
  return t;
};

/** Whoever changes the database past the chain is not bound to whole numbers; the check must still report */
describe("kettePruefen with a value that is no whole number", () => {
  it("reports a row changed to a fraction instead of failing", () => {
    const { db, sqlite } = mitZweiGliedern();
    sqlite.run("UPDATE betriebe SET angelegt_am = 1.5 WHERE betrieb_id = 'weber'");
    expect(kettePruefen(db, "weber")).toEqual([
      { art: "zeile", tabelle: "betriebe", zeile: '["weber"]', grund: "geaendert" },
    ]);
  });

  it("reports a link changed to a fraction instead of failing", () => {
    const { db, sqlite } = mitZweiGliedern();
    const gehalten = aktuellerPruefwert(db, "weber") ?? "";
    sqlite.run("UPDATE audit_glieder SET zeitpunkt = 1.5 WHERE seq = 1");
    expect(kettePruefen(db, "weber")).toEqual([{ art: "glied", seq: 1, grund: "hash" }]);
    expect(pruefwertPruefen(db, "weber", gehalten)).toBe("abweichend");
  });
});
