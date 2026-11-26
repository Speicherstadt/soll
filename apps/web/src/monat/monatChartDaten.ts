import type { Zeile } from "./zeilen.ts";

export type MonatChartDaten = {
  tage: number[];
  istStunden: number[];
  sollStunden: number[];
  kumSaldoStunden: number[];
  hatDaten: boolean;
  maxStunden: number;
};

const rundeStunden = (minuten: number): number => Math.round((minuten / 60) * 100) / 100;

/**
 * Pure chart series builder for the monthly Ist vs. Soll and cumulative balance uPlot views.
 * Keeps weekends/days without target smooth in the cumulative curve by carrying the running balance.
 */
export const monatChartDaten = (zeilen: readonly Zeile[]): MonatChartDaten => {
  const tage: number[] = [];
  const istStunden: number[] = [];
  const sollStunden: number[] = [];
  const kumSaldoStunden: number[] = [];

  let laufendMinuten = 0;
  let maxWert = 0;
  let hatDaten = false;

  for (const zeile of zeilen) {
    const tagNummer = Number.parseInt(zeile.tag.slice(8, 10), 10);
    const istMin = zeile.arbeitsMinuten;
    const sollMin = zeile.sollMinuten ?? 0;
    const istH = rundeStunden(istMin);
    const sollH = rundeStunden(sollMin);

    if (istMin > 0 || sollMin > 0) {
      hatDaten = true;
      laufendMinuten += istMin - sollMin;
    }

    tage.push(Number.isFinite(tagNummer) ? tagNummer : tage.length + 1);
    istStunden.push(istH);
    sollStunden.push(sollH);
    kumSaldoStunden.push(rundeStunden(laufendMinuten));

    if (istH > maxWert) maxWert = istH;
    if (sollH > maxWert) maxWert = sollH;
  }

  const maxStunden = Math.max(10, Math.ceil(maxWert / 2) * 2);

  return { tage, istStunden, sollStunden, kumSaldoStunden, hatDaten, maxStunden };
};
