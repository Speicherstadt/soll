import type { PersonenAntwort } from "./typen.ts";

export type AuslastungPersonenChartDaten = {
  indizes: number[];
  namen: string[];
  abrechenbarStunden: number[];
  internStunden: number[];
  ohneBuchungStunden: number[];
  prozent: number[];
  hatDaten: boolean;
  maxStunden: number;
};

const rundeStunden = (minuten: number): number => Math.round((minuten / 60) * 100) / 100;

/**
 * Pure chart series builder for per-person utilization hours & billable share on Auswertungen.
 */
export const auslastungPersonenChartDaten = (
  personen: readonly PersonenAntwort["personen"][number][],
): AuslastungPersonenChartDaten => {
  const indizes: number[] = [];
  const namen: string[] = [];
  const abrechenbarStunden: number[] = [];
  const internStunden: number[] = [];
  const ohneBuchungStunden: number[] = [];
  const prozent: number[] = [];

  let maxWert = 0;
  let hatDaten = false;

  for (let i = 0; i < personen.length; i++) {
    const p = personen[i];
    if (!p) continue;
    const abr = rundeStunden(p.abrechenbarMinuten);
    const int = rundeStunden(p.internMinuten);
    const ohne = rundeStunden(p.ohneBuchungMinuten);
    if (p.anwesendMinuten > 0) hatDaten = true;

    indizes.push(i);
    namen.push(p.name);
    abrechenbarStunden.push(abr);
    internStunden.push(int);
    ohneBuchungStunden.push(ohne);
    prozent.push(p.abrechenbarProzent ?? 0);

    maxWert = Math.max(maxWert, abr, int, ohne);
  }

  const maxStunden = Math.max(20, Math.ceil((maxWert + 1) / 20) * 20);

  return {
    indizes,
    namen,
    abrechenbarStunden,
    internStunden,
    ohneBuchungStunden,
    prozent,
    hatDaten,
    maxStunden,
  };
};
