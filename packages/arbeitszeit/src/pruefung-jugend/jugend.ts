import { type JugendArbeitszeitBefund, jugendArbeitszeit } from "./arbeitszeit.ts";
import { type FreizeitBefund, freizeit } from "./freizeit.ts";
import { type NachtruheBefund, nachtruhe } from "./nachtruhe.ts";
import { type JugendPausenBefund, jugendRuhepausen } from "./ruhepausen.ts";
import { type JugendRuhetagBefund, jugendRuhetage } from "./ruhetage.ts";
import { type SchichtzeitBefund, schichtzeit } from "./schichtzeit.ts";
import {
  type JugendOptionen,
  nachTag,
  type Pruefergebnis,
  type PruefTag,
  sortiert,
} from "./typen.ts";

export type JugendBefund =
  | JugendArbeitszeitBefund
  | JugendPausenBefund
  | SchichtzeitBefund
  | FreizeitBefund
  | NachtruheBefund
  | JugendRuhetagBefund;

/**
 * §§ 8, 11 to 18 JArbSchG on one person's working days (R-15 to R-20), on the days before the 18th
 * birthday: the findings in calendar order of their first day, R-15 before R-16 and so on within a
 * day, and the days no rule version or holiday table covers. The rules of the ArbZG apply alongside
 * (S-202, S-203); where the JArbSchG is stricter, its finding is the one that matters.
 */
export const jugendBefunde = (
  tage: readonly PruefTag[],
  optionen: JugendOptionen,
): Pruefergebnis<JugendBefund> => {
  const ergebnisse: Pruefergebnis<JugendBefund>[] = [
    jugendArbeitszeit(tage, optionen),
    jugendRuhepausen(tage, optionen),
    schichtzeit(tage, optionen),
    freizeit(tage, optionen),
    nachtruhe(tage, optionen),
    jugendRuhetage(tage, optionen),
  ];
  return {
    befunde: nachTag(ergebnisse.flatMap((ergebnis) => ergebnis.befunde)),
    nichtHinterlegt: sortiert(ergebnisse.flatMap((ergebnis) => ergebnis.nichtHinterlegt)),
  };
};
