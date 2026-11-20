import { type ErsatzruhetagBefund, ersatzruhetag } from "./ersatzruhetag.ts";
import { type FreieSonntageBefund, freieSonntage } from "./freie-sonntage.ts";
import {
  type NachtarbeitnehmerBefund,
  type NachtarbeitnehmerOptionen,
  nachtarbeitnehmer,
} from "./nachtarbeitnehmer.ts";
import {
  type SonntagsruheBefund,
  type SonntagsruheOptionen,
  sonntagsruhe,
} from "./sonntagsruhe.ts";
import { nachTag, type Pruefergebnis, type PruefTag, sortiert } from "./typen.ts";

export type NachtSonntagBefund =
  | NachtarbeitnehmerBefund
  | SonntagsruheBefund
  | FreieSonntageBefund
  | ErsatzruhetagBefund;

/** What the checks of §§ 2, 6, 9 to 11 ArbZG need besides the working days; see each rule for defaults */
export type NachtSonntagOptionen = NachtarbeitnehmerOptionen & SonntagsruheOptionen;

/**
 * §§ 2, 6, 9 to 11 ArbZG on one person's working days (R-06 to R-09): the findings in calendar
 * order of their first day, R-06 before R-07 before R-08 before R-09 within a day, and the days no
 * rule version or holiday table covers. Pass the working days from 1 January of the year before.
 */
export const nachtSonntagBefunde = (
  tage: readonly PruefTag[],
  optionen: NachtSonntagOptionen,
): Pruefergebnis<NachtSonntagBefund> => {
  const ergebnisse: Pruefergebnis<NachtSonntagBefund>[] = [
    nachtarbeitnehmer(tage, optionen),
    sonntagsruhe(tage, optionen),
    freieSonntage(tage, optionen),
    ersatzruhetag(tage, optionen),
  ];
  return {
    befunde: nachTag(ergebnisse.flatMap((ergebnis) => ergebnis.befunde)),
    nichtHinterlegt: sortiert(ergebnisse.flatMap((ergebnis) => ergebnis.nichtHinterlegt)),
  };
};
