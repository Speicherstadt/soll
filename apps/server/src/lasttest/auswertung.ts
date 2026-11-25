/**
 * Evaluates a load test (BAULISTE.md S-904): latency percentiles, errors and the verdict against
 * the threshold decided in docs/plan.md ("Entscheidungen", "Lasttest"). Pure functions on data.
 */

/** One stamp request: how long it took in whole milliseconds, and its HTTP status (0: no answer) */
export type Messung = { dauerMs: number; status: number };

/** What a run must meet to pass */
export type Schwelle = { p95Ms: number; maxMs: number };

/** The threshold of docs/plan.md for 50 businesses with 50 people each in the same minute */
export const SCHWELLE: Schwelle = { p95Ms: 15_000, maxMs: 30_000 };

export type Auswertung = {
  anzahl: number;
  fehler: number;
  /** each status other than 201 with how often it came */
  status: Record<string, number>;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  bestanden: boolean;
  gruende: string[];
};

/** The nearest-rank percentile of ascending values: the smallest value with p % at or below it */
export const perzentil = (aufsteigend: readonly number[], p: number): number => {
  if (aufsteigend.length === 0) return 0;
  const rang = Math.ceil((p / 100) * aufsteigend.length);
  return aufsteigend[Math.min(Math.max(rang, 1), aufsteigend.length) - 1] as number;
};

const statusZaehlen = (messungen: readonly Messung[]): Record<string, number> => {
  const zaehler: Record<string, number> = {};
  for (const { status } of messungen) {
    if (status !== 201) zaehler[String(status)] = (zaehler[String(status)] ?? 0) + 1;
  }
  return zaehler;
};

/** The figures of a run and whether it passed: no error, p95 and the slowest request under the threshold */
export const auswerten = (
  messungen: readonly Messung[],
  erwartet: number,
  schwelle: Schwelle,
): Auswertung => {
  const dauern = messungen.map((m) => m.dauerMs).toSorted((a, b) => a - b);
  const fehler = messungen.filter((m) => m.status !== 201).length;
  const werte = {
    anzahl: messungen.length,
    fehler,
    status: statusZaehlen(messungen),
    p50Ms: perzentil(dauern, 50),
    p95Ms: perzentil(dauern, 95),
    p99Ms: perzentil(dauern, 99),
    maxMs: dauern.at(-1) ?? 0,
  };
  const gruende = [
    ...(messungen.length !== erwartet ? [`${messungen.length} of ${erwartet} requests made`] : []),
    ...(fehler > 0 ? [`${fehler} requests without 201`] : []),
    ...(werte.p95Ms > schwelle.p95Ms ? [`p95 ${werte.p95Ms} ms > ${schwelle.p95Ms} ms`] : []),
    ...(werte.maxMs > schwelle.maxMs ? [`max ${werte.maxMs} ms > ${schwelle.maxMs} ms`] : []),
  ];
  return { ...werte, bestanden: gruende.length === 0, gruende };
};
