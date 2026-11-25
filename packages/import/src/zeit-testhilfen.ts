import { expect } from "vitest";

/*
 * The time limit of a reader in the tests (BAULISTE.md S-701, S-702: no file hangs a reader), made
 * robust against a loaded machine (review S-702, round 2; docs/plan.md, "Zeitgrenze der Leser"):
 * the limit is the larger of the fixed one and a multiple of a reference pass measured on the same
 * machine before and after a run that took longer than the fixed one. A linear reader stays within the
 * multiple however slow the machine is; one quadratic on 5 MiB takes minutes and fails either way.
 */

/** The largest file the server accepts (apps/server/src/modules/umzug/datei.ts) */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * How many references the slowest reader may take. A reference is eight linear passes over 5 MiB
 * (about 0.2 s on a free core), long enough that a loaded machine slices it as it slices a reader;
 * the worst cases measured (19,000 lines of a spreadsheet with a SHA-256 each, a zip bomb inflated
 * to the budget, 2 million `&` in XML) take two to three of them on a free machine and up to six
 * on a loaded one
 */
export const FAKTOR = 10;

/** A linear pass over 5 MiB of text: building it, scanning it, encoding it */
const referenzlauf = (): number => {
  const text = "Sandra;01.09.2026;7:00;8:00\n".repeat(Math.ceil(MAX_BYTES / 28));
  let trenner = 0;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 59) trenner++;
  return new TextEncoder().encode(text).length + trenner;
};

/** Eight reference passes, measured now, in ms */
const referenz = (): number => {
  const start = performance.now();
  for (let i = 0; i < 8; i++) referenzlauf();
  return performance.now() - start;
};

/** The reference measured before runs, kept for two seconds so many small cases share one */
let vorher = { am: Number.NEGATIVE_INFINITY, ms: 0 };

const referenzVorher = (): number => {
  if (performance.now() - vorher.am > 2000) vorher = { am: performance.now(), ms: referenz() };
  return vorher.ms;
};

/** The limit for a reader: at least `mindestens` ms, more on a machine slower than that allows */
export const zeitgrenze = (mindestens: number, referenzen: readonly number[]): number =>
  Math.max(mindestens, FAKTOR * Math.max(...referenzen));

/**
 * Runs a reader and fails when it took longer than its limit; returns what it read. The machine is
 * measured before the run and, when the run took longer than the fixed limit, right after it, and
 * the slower of the two counts: load comes and goes in bursts on a shared runner
 */
export const inZeit = <T>(lesen: () => T, mindestens = 1000): T => {
  const davor = referenzVorher();
  const start = performance.now();
  const ergebnis = lesen();
  const dauer = performance.now() - start;
  if (dauer >= mindestens) expect(dauer).toBeLessThan(zeitgrenze(mindestens, [davor, referenz()]));
  return ergebnis;
};
