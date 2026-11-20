import { describe, expect, it } from "vitest";
import { arbeitstage } from "./arbeitstag.ts";
import type { Stempelart, Stempelung } from "./stempelungen.ts";

/*
 * Eighth review of PR #11: the stamps were read in quadratic to cubic time (each stamp cut all
 * shifts again, each step copied every stretch), so 5000 stamps of one shift took seconds. The
 * function runs on the server for every person of every business (S-904) and, once the REST API
 * exists, on whatever a client sends; it has to stay near linear.
 *
 * The numbers behind the bound (ninth review, 4 cores, the fastest of three runs, measured three
 * times each; "overloaded": the whole suite with six busy loops beside it):
 *
 *   case                          alone       whole suite   overloaded    quadratic (285ae5a)
 *   20000 stamps of working days  72–116 ms   61–75 ms      148–201 ms    8.2 s
 *   5000 stamps of one shift      3–6 ms      4–6 ms        3–11 ms       28 s
 *
 * The bound was 200 ms with 5000 stamps of working days: the overloaded suite reached 87 ms, a
 * margin of only 2 for a slower CI machine, and the quadratic version took only 0.6 s there. With
 * 20000 stamps the quadratic version takes 8 s and the linear one stays far below 1 s: a bound of
 * 1 s leaves a margin of 5 on an overloaded machine and still fails a quadratic version by a
 * factor of 8 or more.
 */
const MINUTE = 60_000;
const TAG = 24 * 60 * MINUTE;
const START = Date.parse("2026-11-16T06:00:00Z");
const SCHRANKE_MS = 1000;

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
  it("reads 20000 stamps of years of working days within the bound", () => {
    const stempelungen = Array.from({ length: 20_000 }, (_, index) => ({
      art: ARBEITSTAG[index % 4] as Stempelart,
      zeitpunkt: START + Math.floor(index / 4) * TAG + (index % 4) * 3 * 60 * MINUTE,
    }));
    expect(dauer(stempelungen)).toBeLessThan(SCHRANKE_MS);
  });

  it("reads 5000 stamps a terminal resends within one shift within the bound", () => {
    const stempelungen = Array.from({ length: 5000 }, (_, index) => ({
      art: (index % 2 === 0 ? "kommen" : "gehen") as Stempelart,
      zeitpunkt: START + index * 15_000,
    }));
    expect(dauer(stempelungen)).toBeLessThan(SCHRANKE_MS);
  });
});
