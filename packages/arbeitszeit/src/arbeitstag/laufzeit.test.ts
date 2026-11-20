import { describe, expect, it } from "vitest";
import { arbeitstage } from "./arbeitstag.ts";
import type { Stempelart, Stempelung } from "./stempelungen.ts";

/*
 * Eighth review of PR #11: the stamps were read in quadratic to cubic time (each stamp cut all
 * shifts again, each step copied every stretch), so 5000 stamps of one shift took seconds. The
 * function runs on the server for every person of every business (S-904) and, once the REST API
 * exists, on whatever a client sends; it has to stay near linear.
 */
const MINUTE = 60_000;
const TAG = 24 * 60 * MINUTE;
const START = Date.parse("2026-11-16T06:00:00Z");
const ANZAHL = 5000;
const SCHRANKE_MS = 200;

/** The fastest of three runs: other test files running at the same time only slow a run down */
const dauer = (stempelungen: Stempelung[]): number => {
  arbeitstage(stempelungen.slice(0, 100), START);
  const laeufe = [1, 2, 3].map(() => {
    const vorher = performance.now();
    const ergebnis = arbeitstage(stempelungen, START + 10_000 * TAG);
    expect(ergebnis.ok).toBe(true);
    return performance.now() - vorher;
  });
  return Math.min(...laeufe);
};

const ARBEITSTAG: readonly Stempelart[] = ["kommen", "pause_beginn", "pause_ende", "gehen"];

describe("running time", () => {
  it("reads 5000 stamps of years of working days within the bound", () => {
    const stempelungen = Array.from({ length: ANZAHL }, (_, index) => ({
      art: ARBEITSTAG[index % 4] as Stempelart,
      zeitpunkt: START + Math.floor(index / 4) * TAG + (index % 4) * 3 * 60 * MINUTE,
    }));
    expect(dauer(stempelungen)).toBeLessThan(SCHRANKE_MS);
  });

  it("reads 5000 stamps a terminal resends within one shift within the bound", () => {
    const stempelungen = Array.from({ length: ANZAHL }, (_, index) => ({
      art: (index % 2 === 0 ? "kommen" : "gehen") as Stempelart,
      zeitpunkt: START + index * 15_000,
    }));
    expect(dauer(stempelungen)).toBeLessThan(SCHRANKE_MS);
  });
});
