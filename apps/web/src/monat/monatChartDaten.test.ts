import { describe, expect, it } from "vitest";
import { monatChartDaten } from "./monatChartDaten.ts";
import type { Zeile } from "./zeilen.ts";

const zeile = (
  tag: string,
  arbeitsMinuten: number,
  sollMinuten: number | null,
  beginn: number | null = arbeitsMinuten > 0 ? 1 : null,
): Zeile => ({
  tag,
  beginn,
  ende: beginn !== null ? beginn + arbeitsMinuten * 60_000 : null,
  pauseMinuten: 0,
  arbeitsMinuten,
  sollMinuten,
  befunde: [],
  geaendert: false,
  abwesenheiten: [],
});

describe("monatChartDaten", () => {
  it("liefert hatDaten=false ohne Eintraege oder bei lauter Nulltagen", () => {
    expect(monatChartDaten([]).hatDaten).toBe(false);
    expect(monatChartDaten([zeile("2026-11-01", 0, 0, null)]).hatDaten).toBe(false);
  });

  it("rechnet Tagesstunden (Ist/Soll) und kumulierten Saldo ueber den Monat", () => {
    const daten = monatChartDaten([
      zeile("2026-11-02", 510, 480), // +0.5h -> kum +0.5h
      zeile("2026-11-03", 450, 480), // -0.5h -> kum 0.0h
      zeile("2026-11-04", 0, 0, null), // Wochenende -> kum bleibt 0.0h
      zeile("2026-11-05", 540, 480), // +1.0h -> kum +1.0h
    ]);

    expect(daten.hatDaten).toBe(true);
    expect(daten.tage).toEqual([2, 3, 4, 5]);
    expect(daten.istStunden).toEqual([8.5, 7.5, 0, 9]);
    expect(daten.sollStunden).toEqual([8, 8, 0, 8]);
    expect(daten.kumSaldoStunden).toEqual([0.5, 0, 0, 1]);
    expect(daten.maxStunden).toBe(10);
  });

  it("skaliert maxStunden auf das naechste gerade Stunden-Vielfache oberhalb von 10 h", () => {
    const daten = monatChartDaten([zeile("2026-11-02", 690, 480)]); // 11.5h
    expect(daten.maxStunden).toBe(12);
  });

  it("behandelt fehlendes Modell (sollMinuten=null) als 0 h Soll ohne NaN", () => {
    const daten = monatChartDaten([zeile("2026-11-02", 300, null)]);
    expect(daten.sollStunden).toEqual([0]);
    expect(daten.kumSaldoStunden).toEqual([5]);
  });
});
