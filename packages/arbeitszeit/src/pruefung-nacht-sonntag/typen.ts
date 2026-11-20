import type { Stueck } from "../arbeitstag/schichten.ts";
import { geschlossen, type PruefTag } from "../pruefung/typen.ts";

/*
 * Helpers of the checks of §§ 2, 6, 9 to 11 ArbZG on top of the shapes of §§ 3 to 5 ArbZG (S-202,
 * pruefung/typen.ts): both read the same working days.
 */
export {
  arbeitsMinutenAm,
  geschlossen,
  nachTag,
  type Pruefergebnis,
  type PruefSchicht,
  type PruefTag,
  sortiert,
} from "../pruefung/typen.ts";

export const MINUTE = 60_000;

/** The work of the closed shifts of the days: blocks between Ruhepausen, short interruptions included */
export const arbeitsbloecke = (tage: readonly PruefTag[]): Stueck[] =>
  tage.flatMap((tag) => geschlossen(tag).flatMap((schicht) => schicht.bloecke));

/** Whole minutes two spans on whole minutes share */
export const gemeinsameMinuten = (
  a: { beginn: number; ende: number },
  b: { beginn: number; ende: number },
): number => Math.max(0, Math.min(a.ende, b.ende) - Math.max(a.beginn, b.beginn)) / MINUTE;
