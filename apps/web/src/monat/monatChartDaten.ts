import type { SichtbareArt } from "@soll/arbeitszeit";
import type { Zeile, ZeilenAbwesenheit } from "./zeilen.ts";

export type MonatChartDaten = {
  tage: number[];
  istStunden: number[];
  sollStunden: number[];
  kumSaldoStunden: number[];
  hatDaten: boolean;
  maxStunden: number;
};

const GUTGESCHRIEBEN: ReadonlySet<SichtbareArt> = new Set([
  "urlaub",
  "krank",
  "kind_krank",
  "sonderurlaub",
  "abwesend",
]);

const abwesenheitsGutschrift = (
  abwesenheiten: readonly ZeilenAbwesenheit[],
  sollMinuten: number,
): number => {
  if (sollMinuten <= 0 || abwesenheiten.length === 0) return 0;
  const summe = abwesenheiten
    .filter((a) => GUTGESCHRIEBEN.has(a.art))
    .reduce((teil, a) => teil + (a.halb === true ? Math.ceil(sollMinuten / 2) : sollMinuten), 0);
  return Math.min(sollMinuten, summe);
};

const rundeStunden = (minuten: number): number => Math.round((minuten / 60) * 100) / 100;

/**
 * Pure chart series builder for the monthly Ist vs. Soll and cumulative balance uPlot views.
 * Credits paid absences (urlaub, krank, kind_krank, sonderurlaub, redacted abwesend) matching
 * packages/arbeitszeit/src/soll/abwesenheit.ts, while ueberstundenabbau draws from the balance.
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
    const sollMin = zeile.sollMinuten ?? 0;
    const istMin = zeile.arbeitsMinuten + abwesenheitsGutschrift(zeile.abwesenheiten, sollMin);
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
