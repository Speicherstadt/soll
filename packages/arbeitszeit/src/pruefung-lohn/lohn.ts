import { istMonat, type Monat, monatVon } from "../kalender/monat.ts";
import type { Tag } from "../kalender/tag.ts";
import { geschlossen, type PruefTag } from "../pruefung/typen.ts";

/**
 * The wage on the working-time model (S-303, docs/plan.md "Lohn im Arbeitszeitmodell"): per month or
 * per hour, in whole cents
 */
export type Lohn = { art: "monat" | "stunde"; cent: number };

/**
 * A surcharge paid for the month, in whole cents. `steuerfrei` marks the part free of tax under
 * § 3b EStG (S-207); it is no Arbeitsentgelt for the mini-job limit (§ 1 Abs. 1 Satz 1 Nr. 1 SvEV).
 * Unknown means taxed, which counts towards the limit: the stricter reading.
 */
export type Zuschlag = {
  art: "sonntag" | "feiertag" | "nacht";
  cent: number;
  steuerfrei?: boolean;
};

/**
 * One person's month for the wage rules (R-14, R-32): the wage of the model in force, whether that
 * model is a mini-job, the surcharges and the working days of the month (S-201, `PruefTag`)
 */
export type Lohnmonat = {
  monat: Monat;
  lohn: Lohn;
  minijob: boolean;
  zuschlaege?: readonly Zuschlag[];
  tage: readonly PruefTag[];
};

export type LohnErgebnis<T> = { ok: true; wert: T } | { ok: false; grund: "ungueltig" };

const centGueltig = (cent: number): boolean => Number.isSafeInteger(cent) && cent >= 0;

/** Every month once, with whole, non-negative cents and only working days of its own month */
export const monateGueltig = (monate: readonly Lohnmonat[]): boolean =>
  new Set(monate.map((monat) => monat.monat)).size === monate.length &&
  monate.every(
    (monat) =>
      istMonat(monat.monat) &&
      (monat.lohn.art === "monat" || monat.lohn.art === "stunde") &&
      centGueltig(monat.lohn.cent) &&
      (monat.zuschlaege ?? []).every((zuschlag) => centGueltig(zuschlag.cent)) &&
      monat.tage.every((tag) => monatVon(tag.tag) === monat.monat),
  );

/** The working days with time worked in closed shifts (R-01 reports the open ones) */
export const tageMitArbeit = (monat: Lohnmonat): Tag[] =>
  monat.tage.filter((tag) => geschlossen(tag).some((s) => s.arbeitsMinuten > 0)).map((t) => t.tag);

/** § 2 Abs. 1 ArbZG: the working time of the month's closed shifts, in whole minutes */
export const arbeitsMinutenIm = (monat: Lohnmonat): number =>
  monat.tage.reduce(
    (summe, tag) => summe + geschlossen(tag).reduce((teil, s) => teil + s.arbeitsMinuten, 0),
    0,
  );

/**
 * The wage of the month times 60, in cents: a whole number for an hourly wage too (cents per hour ×
 * minutes), so no rule divides or rounds (R-14: `lohnCent × 60 ≥ mindestlohnCent × minuten`).
 * `zaehlt` picks the surcharges the rule counts.
 */
export const lohnMal60 = (monat: Lohnmonat, zaehlt: (zuschlag: Zuschlag) => boolean): number => {
  const grund =
    monat.lohn.art === "monat" ? monat.lohn.cent * 60 : monat.lohn.cent * arbeitsMinutenIm(monat);
  const zuschlaege = (monat.zuschlaege ?? []).filter(zaehlt).reduce((s, z) => s + z.cent, 0);
  return grund + zuschlaege * 60;
};

/** A value times 60 in whole cents: down for what is paid, up for what is owed or over a limit */
export const centAbgerundet = (mal60: number): number => Math.floor(mal60 / 60);
export const centAufgerundet = (mal60: number): number => Math.ceil(mal60 / 60);
