import { describe, expect, it } from "vitest";
import { ueberstundenChartDaten } from "./ueberstundenChartDaten.ts";

describe("ueberstundenChartDaten", () => {
  it("liefert hatDaten=false bei fehlendem oder zu kurzem Verlauf (< 2 Monate)", () => {
    expect(ueberstundenChartDaten(undefined).hatDaten).toBe(false);
    expect(ueberstundenChartDaten([]).hatDaten).toBe(false);
    expect(ueberstundenChartDaten([{ monat: "2026-11", saldoMinuten: 60 }]).hatDaten).toBe(false);
  });

  it("wandelt Monatsverlauf in Stunden-Reihe um und merkt letzten Saldo", () => {
    const daten = ueberstundenChartDaten([
      { monat: "2026-08", saldoMinuten: -30 },
      { monat: "2026-09", saldoMinuten: 90 },
      { monat: "2026-10", saldoMinuten: 215 },
    ]);

    expect(daten.hatDaten).toBe(true);
    expect(daten.indizes).toEqual([0, 1, 2]);
    expect(daten.monate).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(daten.stunden).toEqual([-0.5, 1.5, 3.58]);
    expect(daten.letzterSaldoMinuten).toBe(215);
  });
});
