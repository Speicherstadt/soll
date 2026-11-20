import { expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { aktuellerPruefwert, pruefwertPruefen, schreiben } from "./index.ts";

const weber = { betriebId: "weber", akteur: "jonas", jetzt: 1_790_000_000_000 };

/**
 * A Prüfwert a person holds was issued from the chain, so the chain once reached its number. Cutting
 * the chain back below it and resetting the head to match must show as a deviation, not as an unknown
 * number: that is exactly the change the Prüfwert exists to expose.
 */
it("shows a chain cut back below a held Prüfwert, head and all, as a deviation", () => {
  const { db, sqlite, schreibDb } = testDatenbank();
  schreiben(schreibDb, weber, (s) =>
    s.einfuegen("betriebe", { betriebId: "weber", name: "Weber", angelegtAm: 1 }),
  );
  for (const name of ["A", "B", "C", "D"]) {
    schreiben(schreibDb, weber, (s) => s.aendern("betriebe", { betriebId: "weber" }, { name }));
  }
  const gehalten = aktuellerPruefwert(db, "weber") ?? "";
  sqlite.run("DELETE FROM audit_glieder WHERE seq >= 3");
  sqlite.run("DELETE FROM audit_inhalte WHERE seq >= 3");
  sqlite.run(
    "UPDATE audit_koepfe SET seq = 2, hash = (SELECT hash FROM audit_glieder WHERE betrieb_id = 'weber' AND seq = 2)",
  );
  expect(pruefwertPruefen(db, "weber", gehalten)).toBe("abweichend");
});
