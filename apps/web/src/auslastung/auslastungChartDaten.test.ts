import { describe, expect, it } from "vitest";
import { auslastungPersonenChartDaten } from "./auslastungChartDaten.ts";

describe("auslastungPersonenChartDaten", () => {
  it("liefert hatDaten=false bei leerer Personenliste", () => {
    expect(auslastungPersonenChartDaten([]).hatDaten).toBe(false);
  });

  it("rechnet Minuten in Stunden um und berechnet maxStunden", () => {
    const daten = auslastungPersonenChartDaten([
      {
        nutzerId: "u1",
        name: "Jonas Weber",
        anwesendMinuten: 9600,
        abrechenbarMinuten: 7200,
        internMinuten: 1200,
        ohneBuchungMinuten: 1200,
        abrechenbarProzent: 75,
      },
      {
        nutzerId: "u2",
        name: "Miriam Koch",
        anwesendMinuten: 8400,
        abrechenbarMinuten: 5400,
        internMinuten: 1800,
        ohneBuchungMinuten: 1200,
        abrechenbarProzent: 64,
      },
    ]);

    expect(daten.hatDaten).toBe(true);
    expect(daten.indizes).toEqual([0, 1]);
    expect(daten.namen).toEqual(["Jonas Weber", "Miriam Koch"]);
    expect(daten.abrechenbarStunden).toEqual([120, 90]);
    expect(daten.internStunden).toEqual([20, 30]);
    expect(daten.ohneBuchungStunden).toEqual([20, 20]);
    expect(daten.prozent).toEqual([75, 64]);
    expect(daten.maxStunden).toBe(140);
  });

  it("ersetzt null-Prozent mit 0", () => {
    const daten = auslastungPersonenChartDaten([
      {
        nutzerId: "u1",
        name: "Neu",
        anwesendMinuten: 0,
        abrechenbarMinuten: 0,
        internMinuten: 0,
        ohneBuchungMinuten: 0,
        abrechenbarProzent: null,
      },
    ]);
    expect(daten.prozent).toEqual([0]);
    expect(daten.hatDaten).toBe(false);
  });
});
