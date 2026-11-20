import {
  type AusgleichBefund,
  type AusgleichOptionen,
  ausgleichszeitraum,
} from "./ausgleichszeitraum.ts";
import { type HoechstarbeitszeitBefund, hoechstarbeitszeit } from "./hoechstarbeitszeit.ts";
import { type RuhepausenBefund, ruhepausen } from "./ruhepausen.ts";
import { type RuhezeitBefund, type RuhezeitOptionen, ruhezeit } from "./ruhezeit.ts";
import { nachTag, type Pruefergebnis, type PruefTag, sortiert } from "./typen.ts";

export type ArbzgBefund =
  | HoechstarbeitszeitBefund
  | AusgleichBefund
  | RuhepausenBefund
  | RuhezeitBefund;

/** What the checks of §§ 3 to 5 ArbZG need besides the working days; see each rule for defaults */
export type ArbzgOptionen = AusgleichOptionen & Omit<RuhezeitOptionen, "jetzt">;

/**
 * §§ 3 to 5 ArbZG on one person's working days (R-02 to R-05): the findings in calendar order of
 * their first day, R-02 before R-03 before R-04 before R-05 within a day, and the days no rule
 * version covers.
 */
export const arbzgBefunde = (
  tage: readonly PruefTag[],
  optionen: ArbzgOptionen,
): Pruefergebnis<ArbzgBefund> => {
  const ergebnisse: Pruefergebnis<ArbzgBefund>[] = [
    hoechstarbeitszeit(tage),
    ausgleichszeitraum(tage, optionen),
    ruhepausen(tage),
    ruhezeit(tage, optionen),
  ];
  return {
    befunde: nachTag(ergebnisse.flatMap((ergebnis) => ergebnis.befunde)),
    nichtHinterlegt: sortiert(ergebnisse.flatMap((ergebnis) => ergebnis.nichtHinterlegt)),
  };
};
