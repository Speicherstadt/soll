import { describe, expect, it } from "vitest";
import { monatChartDaten } from "./monatChartDaten.ts";
import type { Zeile, ZeilenAbwesenheit } from "./zeilen.ts";

const zeile = (
  tag: string,
  arbeitsMinuten: number,
  sollMinuten: number | null,
  abwesenheiten: ZeilenAbwesenheit[] = [],
): Zeile => ({
  tag,
  beginn: arbeitsMinuten > 0 ? 1 : null,
  ende: arbeitsMinuten > 0 ? 1 + arbeitsMinuten * 60_000 : null,
  pauseMinuten: 0,
  arbeitsMinuten,
  sollMinuten,
  befunde: [],
  geaendert: false,
  abwesenheiten,
});

describe("monatChartDaten (tdd-review)", () => {
  it("credits paid full-day absences (urlaub, krank, abwesend) to Ist and balance, but not ueberstundenabbau", () => {
    const daten = monatChartDaten([
      zeile("2026-11-02", 0, 480, [{ art: "urlaub" }]),
      zeile("2026-11-03", 0, 480, [{ art: "krank" }]),
      zeile("2026-11-04", 0, 480, [{ art: "abwesend" }]),
      zeile("2026-11-05", 0, 480, [{ art: "ueberstundenabbau" }]),
    ]);

    expect(daten.hatDaten).toBe(true);
    // Paid absences credit full Soll (8 h) so cumulative balance stays 0; ueberstundenabbau draws -8 h
    expect(daten.istStunden).toEqual([8, 8, 8, 0]);
    expect(daten.kumSaldoStunden).toEqual([0, 0, 0, -8]);
  });

  it("credits half-day paid absence rounded up (Math.ceil, never to employee's disadvantage)", () => {
    const daten = monatChartDaten([
      zeile("2026-11-02", 240, 480, [{ art: "urlaub", halb: true }]),
      // Odd Soll (465 min): half day credits Math.ceil(465 / 2) = 233 min; 232 min worked + 233 = 465 -> 0 balance
      zeile("2026-11-03", 232, 465, [{ art: "sonderurlaub", halb: true }]),
    ]);

    expect(daten.kumSaldoStunden).toEqual([0, 0]);
  });
});
