import type { Monat } from "@soll/arbeitszeit";

export type UeberstundenVerlaufPunkt = { monat: Monat; saldoMinuten: number };

export type UeberstundenChartDaten = {
  indizes: number[];
  monate: Monat[];
  stunden: number[];
  hatDaten: boolean;
  letzterSaldoMinuten: number;
};

const rundeStunden = (minuten: number): number => Math.round((minuten / 60) * 100) / 100;

/**
 * Pure chart series builder for the monthly overtime balance trend on /abwesenheiten.
 * Requires at least 2 months to draw a meaningful trend curve.
 */
export const ueberstundenChartDaten = (
  verlauf: readonly UeberstundenVerlaufPunkt[] | undefined,
): UeberstundenChartDaten => {
  if (!verlauf || verlauf.length < 2) {
    return { indizes: [], monate: [], stunden: [], hatDaten: false, letzterSaldoMinuten: 0 };
  }
  const indizes: number[] = [];
  const monate: Monat[] = [];
  const stunden: number[] = [];

  for (let i = 0; i < verlauf.length; i++) {
    const punkt = verlauf[i];
    if (!punkt) continue;
    indizes.push(i);
    monate.push(punkt.monat);
    stunden.push(rundeStunden(punkt.saldoMinuten));
  }

  const letzter = verlauf[verlauf.length - 1];
  return {
    indizes,
    monate,
    stunden,
    hatDaten: indizes.length >= 2,
    letzterSaldoMinuten: letzter?.saldoMinuten ?? 0,
  };
};
