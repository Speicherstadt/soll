import type { Befund } from "../befund.ts";
import { type Monat, monatVon, plusMonate } from "../kalender/monat.ts";
import type { Tag } from "../kalender/tag.ts";
import type { Pruefergebnis, PruefTag } from "../pruefung/typen.ts";
import type { Lohn, Lohnmonat } from "../pruefung-lohn/lohn.ts";
import { mindestlohn } from "../pruefung-lohn/mindestlohn.ts";
import { minijobGrenze } from "../pruefung-lohn/minijob.ts";

/** The wage of a month and whether it is a mini-job, from the model in force; null: "nicht hinterlegt" */
export type LohnAm = (monat: Monat) => { lohn: Lohn; minijob: boolean } | null;

/** § 8 Abs. 1b SGB IV looks back over the Zeitjahr: the twelve months up to the one judged */
const ZEITJAHR = 12;

/**
 * The months the wage rules read for a plan: from eleven months before the first planned month to the
 * last, each with its working days, as far as its wage is known (R-14, R-32)
 */
const lohnmonate = (
  tage: readonly PruefTag[],
  geplant: readonly Tag[],
  lohnAm: LohnAm,
): Lohnmonat[] => {
  const [erster] = geplant;
  const letzter = geplant.at(-1);
  if (erster === undefined || letzter === undefined) return [];
  const monate: Lohnmonat[] = [];
  for (
    let monat = plusMonate(monatVon(erster), 1 - ZEITJAHR);
    monat <= monatVon(letzter);
    monat = plusMonate(monat, 1)
  ) {
    const lohn = lohnAm(monat);
    if (lohn) monate.push({ monat, ...lohn, tage: tage.filter((t) => monatVon(t.tag) === monat) });
  }
  return monate;
};

/**
 * The minimum wage (§ 1 MiLoG) and the mini-job limit (§ 8 SGB IV) with the plan as worked: the
 * month's stamps so far and its planned shifts. Input the rules refuse as invalid gives no finding.
 */
export const lohnBefunde = (
  tage: readonly PruefTag[],
  geplant: readonly Tag[],
  lohnAm: LohnAm | undefined,
): Pruefergebnis<Befund> => {
  const monate = lohnAm ? lohnmonate(tage, geplant, lohnAm) : [];
  if (monate.length === 0) return { befunde: [], nichtHinterlegt: [] };
  const ergebnisse: Pruefergebnis<Befund>[] = [mindestlohn(monate), minijobGrenze(monate)].flatMap(
    (e) => (e.ok ? [e.wert as Pruefergebnis<Befund>] : []),
  );
  return {
    befunde: ergebnisse.flatMap((e) => e.befunde),
    nichtHinterlegt: ergebnisse.flatMap((e) => e.nichtHinterlegt),
  };
};
