import { describe, expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { aktuellerPruefwert, kettePruefen, pruefwertPruefen, schreiben } from "./index.ts";

const weber = { betriebId: "weber", akteur: "jonas", jetzt: 1_790_000_000_000 };
const elbblick = { betriebId: "elbblick", akteur: "mia", jetzt: 1_790_000_000_000 };

const standort = (betriebId: string, standortId: string) => ({
  betriebId,
  standortId,
  name: "Werkstatt",
  land: "HH",
  angelegtAm: 1,
});

/** Weber with two sites, one renamed; Elbblick with one; the Prüfwert Weber's people hold */
const zweiBetriebe = () => {
  const t = testDatenbank();
  schreiben(t.schreibDb, weber, (s) => {
    s.einfuegen("standorte", standort("weber", "alt"));
    s.aendern("standorte", { standortId: "alt" }, { name: "Lager" });
    s.einfuegen("standorte", standort("weber", "neu"));
  });
  schreiben(t.schreibDb, elbblick, (s) => s.einfuegen("standorte", standort("elbblick", "alt")));
  return { ...t, gehalten: aktuellerPruefwert(t.db, "weber") ?? "" };
};

const inhalte = (sqlite: ReturnType<typeof testDatenbank>["sqlite"], betriebId: string) =>
  sqlite
    .query("SELECT seq FROM audit_inhalte WHERE betrieb_id = ? ORDER BY seq")
    .all(betriebId)
    .map((zeile) => (zeile as { seq: number }).seq);

describe("removing a row after its retention period (S-901)", () => {
  it("deletes the row and the stored contents of its links, appends a link, and the chain verifies", () => {
    const { db, sqlite, schreibDb, gehalten } = zweiBetriebe();
    const ergebnis = schreiben(schreibDb, { ...weber, akteur: "system" }, (s) =>
      s.aussondern("standorte", { standortId: "alt" }),
    );
    expect(ergebnis).toMatchObject({ zeile: { standortId: "alt", name: "Lager" }, inhalte: 2 });
    expect(
      sqlite.query("SELECT standort_id FROM standorte WHERE betrieb_id = 'weber'").all(),
    ).toEqual([{ standort_id: "neu" }]);
    // links 1 and 2 wrote the removed row: their contents are gone, the links stay
    expect(inhalte(sqlite, "weber")).toEqual([3, 4]);
    expect(
      sqlite.query("SELECT COUNT(*) AS n FROM audit_glieder WHERE betrieb_id = 'weber'").get(),
    ).toEqual({
      n: 4,
    });
    expect(
      sqlite
        .query(
          "SELECT aktion, akteur, zeile FROM audit_glieder WHERE betrieb_id = 'weber' AND seq = 4",
        )
        .get(),
    ).toEqual({ aktion: "loeschen", akteur: "system", zeile: '["alt"]' });
    expect(kettePruefen(db, "weber")).toEqual([]);
    expect(pruefwertPruefen(db, "weber", gehalten)).toBe("gueltig");
  });

  it("leaves another business's row with the same key and its contents alone", () => {
    const { db, sqlite, schreibDb } = zweiBetriebe();
    schreiben(schreibDb, weber, (s) => s.aussondern("standorte", { standortId: "alt" }));
    expect(inhalte(sqlite, "elbblick")).toEqual([1]);
    expect(kettePruefen(db, "elbblick")).toEqual([]);
  });

  it("removes nothing when the transaction rolls back", () => {
    const { sqlite, schreibDb } = zweiBetriebe();
    expect(() =>
      schreiben(schreibDb, weber, (s) => {
        s.aussondern("standorte", { standortId: "alt" });
        throw new Error("abort");
      }),
    ).toThrow("abort");
    expect(inhalte(sqlite, "weber")).toEqual([1, 2, 3]);
  });
});
