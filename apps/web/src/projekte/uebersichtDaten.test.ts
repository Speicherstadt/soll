import { describe, expect, it } from "vitest";
import { budgetProzent, projekteUebersichtDaten } from "./uebersichtDaten.ts";

describe("projekteUebersichtDaten", () => {
  it("zaehlt aktive Auftraege, Budget-Summen, Top-Kunden und Taetigkeiten", () => {
    const daten = projekteUebersichtDaten({
      projekte: [
        {
          projektId: "p1",
          kundeId: "k1",
          name: "Elbhof",
          nummer: "",
          budgetMinuten: 600,
          budgetCent: null,
          warnungProzent: 80,
          archiviertAm: null,
          budget: [{ art: "minuten", verbraucht: 500, budget: 600, rest: 100, stufe: "warnung" }],
        },
        {
          projektId: "p2",
          kundeId: "k1",
          name: "Alt",
          nummer: "",
          budgetMinuten: 600,
          budgetCent: null,
          warnungProzent: 80,
          archiviertAm: 12345,
          budget: [
            { art: "minuten", verbraucht: 700, budget: 600, rest: -100, stufe: "aufgebraucht" },
          ],
        },
      ],
      kunden: [
        { kundeId: "k1", name: "K1", nummer: "", archiviertAm: null },
        { kundeId: "k2", name: "K2", nummer: "", archiviertAm: 999 },
      ],
      taetigkeiten: [
        { taetigkeitId: "t1", name: "Montage", abrechenbar: true, fest: false, archiviertAm: null },
        { taetigkeitId: "t2", name: "Intern", abrechenbar: false, fest: true, archiviertAm: null },
        { taetigkeitId: "t3", name: "Alt", abrechenbar: true, fest: false, archiviertAm: 555 },
      ],
    });

    expect(daten).toEqual({
      aktiveAuftraege: 1,
      budgetWarnungen: 1,
      budgetVerbrauchtMinuten: 500,
      budgetGesamtMinuten: 600,
      budgetAnteilProzent: 83,
      aktiveKunden: 1,
      topKunden: [{ kundeId: "k1", name: "K1", auftraege: 1 }],
      aktiveTaetigkeiten: 2,
      abrechenbareTaetigkeiten: 1,
      abrechenbarProzent: 50,
      taetigkeitNamen: ["Montage", "Intern"],
    });
  });
});

describe("budgetProzent", () => {
  it("klemmt Werte sauber zwischen 0 und 100 und behandelt budget=0 ohne NaN", () => {
    expect(
      budgetProzent({ art: "minuten", verbraucht: 480, budget: 600, rest: 120, stufe: "warnung" }),
    ).toBe(80);
    expect(
      budgetProzent({
        art: "minuten",
        verbraucht: 900,
        budget: 600,
        rest: -300,
        stufe: "aufgebraucht",
      }),
    ).toBe(100);
    expect(
      budgetProzent({ art: "minuten", verbraucht: 100, budget: 0, rest: -100, stufe: "ok" }),
    ).toBe(0);
  });
});
