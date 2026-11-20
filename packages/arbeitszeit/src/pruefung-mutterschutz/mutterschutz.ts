import { type MutterschutzArbeitszeitBefund, mutterschutzArbeitszeit } from "./arbeitszeit.ts";
import { type MonatBefund, monatsdurchschnitt } from "./monat.ts";
import { type MutterschutzNachtBefund, mutterschutzNacht } from "./nachtarbeit.ts";
import { type MutterschutzRuhezeitBefund, mutterschutzRuhezeit } from "./ruhezeit.ts";
import { type SchutzfristBefund, schutzfristen } from "./schutzfristen.ts";
import { type MutterschutzSonntagBefund, mutterschutzSonntag } from "./sonntag.ts";
import {
  type MutterschutzOptionen,
  nachTag,
  type Pruefergebnis,
  type PruefTag,
  sortiert,
} from "./typen.ts";

export type MutterschutzBefund =
  | SchutzfristBefund
  | MutterschutzArbeitszeitBefund
  | MonatBefund
  | MutterschutzRuhezeitBefund
  | MutterschutzNachtBefund
  | MutterschutzSonntagBefund;

/**
 * §§ 3 to 6 MuSchG on one person's working days (R-21): the findings in calendar order of their first
 * day, § 3 before § 4 before § 5 before § 6 within a day, and the days no rule version, holiday table
 * or contractual weekly time covers. The rules of the ArbZG and, under 18, of the JArbSchG apply
 * alongside.
 */
export const mutterschutzBefunde = (
  tage: readonly PruefTag[],
  optionen: MutterschutzOptionen,
): Pruefergebnis<MutterschutzBefund> => {
  const ergebnisse: Pruefergebnis<MutterschutzBefund>[] = [
    schutzfristen(tage, optionen.schutzfristen ?? []),
    mutterschutzArbeitszeit(tage, optionen),
    monatsdurchschnitt(tage, optionen),
    mutterschutzRuhezeit(tage, optionen),
    mutterschutzNacht(tage, optionen),
    mutterschutzSonntag(tage, optionen),
  ];
  return {
    befunde: nachTag(ergebnisse.flatMap((ergebnis) => ergebnis.befunde)),
    nichtHinterlegt: sortiert(ergebnisse.flatMap((ergebnis) => ergebnis.nichtHinterlegt)),
  };
};
