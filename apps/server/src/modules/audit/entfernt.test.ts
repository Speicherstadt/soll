import { describe, expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { aktuellerPruefwert, pruefwertPruefen, schreiben } from "./index.ts";

const weber = { betriebId: "weber", akteur: "jonas", jetzt: 1_790_000_000_000 };

/** Weber Haustechnik with three links; returns the Prüfwert of the third */
const mitGehaltenemPruefwert = () => {
  const t = testDatenbank();
  schreiben(t.db, weber, (s) =>
    s.einfuegen("betriebe", { betriebId: "weber", name: "Weber", angelegtAm: 1 }),
  );
  for (const name of ["Weber Haustechnik", "Weber Haustechnik GmbH"]) {
    schreiben(t.db, weber, (s) => s.aendern("betriebe", { betriebId: "weber" }, { name }));
  }
  return { ...t, gehalten: aktuellerPruefwert(t.db, "weber") ?? "" };
};

/**
 * A Prüfwert names a link the chain once had. When that link is gone while the chain reached its
 * number, the Prüfwert exposes a change; "unbekannt" is for a number the chain never reached.
 */
describe("a Prüfwert whose link was removed past the chain", () => {
  it("is a deviation when later links remain", () => {
    const { db, sqlite, gehalten } = mitGehaltenemPruefwert();
    schreiben(db, weber, (s) =>
      s.aendern("betriebe", { betriebId: "weber" }, { name: "Weber KG" }),
    );
    sqlite.run("DELETE FROM audit_glieder WHERE seq = 3");
    expect(pruefwertPruefen(db, "weber", gehalten)).toBe("abweichend");
  });

  it("is a deviation when it was cut off at the end and the head still names it", () => {
    const { db, sqlite, gehalten } = mitGehaltenemPruefwert();
    sqlite.run("DELETE FROM audit_glieder WHERE seq = 3");
    expect(pruefwertPruefen(db, "weber", gehalten)).toBe("abweichend");
  });
});
