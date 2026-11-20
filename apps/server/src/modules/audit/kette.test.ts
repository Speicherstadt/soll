import { describe, expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { aktuellerPruefwert, kettePruefen, pruefwertPruefen, schreiben } from "./index.ts";

const weber = { betriebId: "weber", akteur: "jonas", jetzt: 1_790_000_000_000 };
const elbblick = { betriebId: "elbblick", akteur: "mia", jetzt: 1_790_000_000_000 };

/** Weber Haustechnik with three links: inserted, renamed, renamed again */
const mitDreiGliedern = () => {
  const t = testDatenbank();
  schreiben(t.db, weber, (s) =>
    s.einfuegen("betriebe", { betriebId: "weber", name: "Weber", angelegtAm: 1 }),
  );
  schreiben(t.db, weber, (s) =>
    s.aendern("betriebe", { betriebId: "weber" }, { name: "Weber Haustechnik" }),
  );
  schreiben(t.db, weber, (s) =>
    s.aendern("betriebe", { betriebId: "weber" }, { name: "Weber Haustechnik GmbH" }),
  );
  return t;
};

describe("schreiben", () => {
  it("appends one link per write; the check finds nothing", () => {
    const { db, sqlite } = mitDreiGliedern();
    expect(kettePruefen(db, "weber")).toEqual([]);
    const glieder = sqlite
      .query("SELECT seq, aktion, akteur FROM audit_glieder ORDER BY seq")
      .all();
    expect(glieder).toEqual([
      { seq: 1, aktion: "einfuegen", akteur: "jonas" },
      { seq: 2, aktion: "aendern", akteur: "jonas" },
      { seq: 3, aktion: "aendern", akteur: "jonas" },
    ]);
    expect(aktuellerPruefwert(db, "weber")).toMatch(/^Nr\. 3 · [0-9a-f]{64}$/);
  });

  it("checks a deleted row as deleted", () => {
    const { db } = mitDreiGliedern();
    schreiben(db, weber, (s) => s.loeschen("betriebe", { betriebId: "weber" }));
    expect(kettePruefen(db, "weber")).toEqual([]);
  });

  it("rolls back the row and its link together", () => {
    const { db, sqlite } = testDatenbank();
    expect(() =>
      schreiben(db, weber, (s) => {
        s.einfuegen("betriebe", { betriebId: "weber", name: "Weber", angelegtAm: 1 });
        throw new Error("abgebrochen");
      }),
    ).toThrow("abgebrochen");
    expect(sqlite.query("SELECT count(*) AS n FROM betriebe").get()).toEqual({ n: 0 });
    expect(sqlite.query("SELECT count(*) AS n FROM audit_glieder").get()).toEqual({ n: 0 });
  });

  it("refuses rows of another business", () => {
    const { db } = mitDreiGliedern();
    expect(() =>
      schreiben(db, elbblick, (s) =>
        s.einfuegen("betriebe", { betriebId: "weber", name: "x", angelegtAm: 1 }),
      ),
    ).toThrow(/another business/);
    expect(() =>
      schreiben(db, elbblick, (s) =>
        s.aendern("betriebe", { betriebId: "weber" }, { name: "gekapert" }),
      ),
    ).toThrow(/expected one row/);
    expect(() =>
      schreiben(db, elbblick, (s) => s.loeschen("betriebe", { betriebId: "weber" })),
    ).toThrow(/expected one row/);
    expect(kettePruefen(db, "weber")).toEqual([]);
  });

  it("keeps one chain per business", () => {
    const { db } = mitDreiGliedern();
    schreiben(db, elbblick, (s) =>
      s.einfuegen("betriebe", { betriebId: "elbblick", name: "Café", angelegtAm: 1 }),
    );
    expect(aktuellerPruefwert(db, "elbblick")).toMatch(/^Nr\. 1 · /);
    expect(kettePruefen(db, "elbblick")).toEqual([]);
    expect(kettePruefen(db, "weber")).toEqual([]);
  });
});

describe("kettePruefen", () => {
  it("finds a row changed past the chain", () => {
    const { db, sqlite } = mitDreiGliedern();
    sqlite.run("UPDATE betriebe SET name = 'Fremd' WHERE betrieb_id = 'weber'");
    expect(kettePruefen(db, "weber")).toEqual([
      { art: "zeile", tabelle: "betriebe", zeile: '["weber"]', grund: "geaendert" },
    ]);
  });

  it("finds a row inserted or deleted past the chain", () => {
    const { db, sqlite } = mitDreiGliedern();
    sqlite.run("DELETE FROM betriebe WHERE betrieb_id = 'weber'");
    expect(kettePruefen(db, "weber")).toEqual([
      { art: "zeile", tabelle: "betriebe", zeile: '["weber"]', grund: "fehlt" },
    ]);
    sqlite.run("INSERT INTO betriebe VALUES ('weber', 'Weber', 1)");
    sqlite.run("INSERT INTO betriebe VALUES ('elbblick', 'Café', 1)");
    expect(kettePruefen(db, "elbblick")).toEqual([
      { art: "zeile", tabelle: "betriebe", zeile: '["elbblick"]', grund: "ohne_glied" },
    ]);
  });

  it("finds a changed link", () => {
    const { db, sqlite } = mitDreiGliedern();
    sqlite.run("UPDATE audit_glieder SET akteur = 'anna' WHERE seq = 2");
    expect(kettePruefen(db, "weber")).toEqual([{ art: "glied", seq: 2, grund: "hash" }]);
  });

  it("finds a link whose hash was recomputed, as the next one no longer points to it", () => {
    const { db, sqlite } = mitDreiGliedern();
    sqlite.run("UPDATE audit_glieder SET hash = '" + "f".repeat(64) + "' WHERE seq = 2");
    expect(kettePruefen(db, "weber")).toEqual(
      expect.arrayContaining([
        { art: "glied", seq: 2, grund: "hash" },
        { art: "glied", seq: 3, grund: "vorgaenger" },
      ]),
    );
  });

  it("finds a link taken out of the middle and one cut off at the end", () => {
    const { db, sqlite } = mitDreiGliedern();
    sqlite.run("DELETE FROM audit_glieder WHERE seq = 2");
    expect(kettePruefen(db, "weber")).toEqual(
      expect.arrayContaining([
        { art: "glied", seq: 3, grund: "luecke" },
        { art: "inhalt", seq: 2, grund: "ohne_glied" },
      ]),
    );
    const zweite = mitDreiGliedern();
    zweite.sqlite.run("DELETE FROM audit_glieder WHERE seq = 3");
    zweite.sqlite.run("DELETE FROM audit_inhalte WHERE seq = 3");
    expect(kettePruefen(zweite.db, "weber")).toEqual(
      expect.arrayContaining([{ art: "kopf", grund: "abweichend" }]),
    );
  });

  it("finds a changed content", () => {
    const { db, sqlite } = mitDreiGliedern();
    sqlite.run(`UPDATE audit_inhalte SET inhalt = '{"name":"Fremd"}' WHERE seq = 1`);
    expect(kettePruefen(db, "weber")).toEqual([{ art: "inhalt", seq: 1, grund: "hash" }]);
  });

  it("is not broken by a content removed after its retention period", () => {
    const { db, sqlite } = mitDreiGliedern();
    sqlite.run("DELETE FROM audit_inhalte WHERE seq IN (1, 2)");
    expect(kettePruefen(db, "weber")).toEqual([]);
  });
});

describe("pruefwertPruefen", () => {
  it("accepts a Prüfwert a person holds, also after later writes", () => {
    const { db } = mitDreiGliedern();
    const gehalten = aktuellerPruefwert(db, "weber") ?? "";
    schreiben(db, weber, (s) =>
      s.aendern("betriebe", { betriebId: "weber" }, { name: "Weber KG" }),
    );
    expect(pruefwertPruefen(db, "weber", gehalten)).toBe("gueltig");
  });

  it("shows a later change to the chain as a deviation", () => {
    const { db, sqlite } = mitDreiGliedern();
    const gehalten = aktuellerPruefwert(db, "weber") ?? "";
    sqlite.run("UPDATE audit_glieder SET akteur = 'anna' WHERE seq = 1");
    expect(pruefwertPruefen(db, "weber", gehalten)).toBe("abweichend");
  });

  it("tells an unknown number and an unreadable text apart", () => {
    const { db } = mitDreiGliedern();
    expect(pruefwertPruefen(db, "weber", `Nr. 99 · ${"a".repeat(64)}`)).toBe("unbekannt");
    expect(pruefwertPruefen(db, "weber", "Nr. 3 · abc")).toBe("unlesbar");
    expect(pruefwertPruefen(db, "elbblick", aktuellerPruefwert(db, "weber") ?? "")).toBe(
      "unbekannt",
    );
  });
});
