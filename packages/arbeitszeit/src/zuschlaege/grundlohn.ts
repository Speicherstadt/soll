import type { ZuschlagGrenzen } from "./grenzen.ts";

/**
 * The Grundlohn of § 3b Abs. 2 Satz 1 EStG: „der laufende Arbeitslohn, der dem Arbeitnehmer bei der
 * für ihn maßgebenden regelmäßigen Arbeitszeit für den jeweiligen Lohnzahlungszeitraum zusteht“, in
 * whole cents. An hourly wage is the Grundlohn per hour itself; a monthly wage is divided by the hours
 * of the regular time: the weekly hours times 4,35 (R 3b Abs. 2 LStR), or, where no regular time is
 * agreed, the hours actually worked in the month (`wochenMinuten: null`, `istMinuten`).
 */
export type Grundlohn =
  | { art: "stunde"; cent: number }
  | { art: "monat"; cent: number; wochenMinuten: number }
  | { art: "monat"; cent: number; wochenMinuten: null; istMinuten: number };

/** Cents per hour as an exact fraction: nothing is rounded before the amount of a day */
export type Bruch = { zaehler: bigint; nenner: bigint };

const ganz = (zahl: number, ab: number): boolean => Number.isSafeInteger(zahl) && zahl >= ab;

export const grundlohnGueltig = (grundlohn: Grundlohn): boolean => {
  if (!ganz(grundlohn.cent, 0)) return false;
  if (grundlohn.art === "stunde") return true;
  if (grundlohn.wochenMinuten !== null) return ganz(grundlohn.wochenMinuten, 1);
  return ganz(grundlohn.istMinuten, 1);
};

/**
 * „er ist in einen Stundenlohn umzurechnen“ (§ 3b Abs. 2 Satz 1 EStG): cents per hour, exactly. A
 * month of `w` weekly minutes has w × 4,35 ÷ 60 hours, so the hourly wage is cent × 60 × 100 ÷
 * (w × 435).
 */
export const grundlohnJeStunde = (grundlohn: Grundlohn, grenzen: ZuschlagGrenzen): Bruch => {
  const cent = BigInt(grundlohn.cent);
  if (grundlohn.art === "stunde") return { zaehler: cent, nenner: 1n };
  if (grundlohn.wochenMinuten === null)
    return { zaehler: cent * 60n, nenner: BigInt(grundlohn.istMinuten) };
  return {
    zaehler: cent * 6000n,
    nenner: BigInt(grundlohn.wochenMinuten) * BigInt(grenzen.wochenJeMonatHundertstel),
  };
};

/** „mit höchstens 50 Euro anzusetzen“: the hourly Grundlohn the tax-free rates apply to */
export const gedeckelt = (stundenlohn: Bruch, grenzen: ZuschlagGrenzen): Bruch => {
  const hoechstens = BigInt(grenzen.grundlohnHoechstensCent) * stundenlohn.nenner;
  return stundenlohn.zaehler > hoechstens ? { ...stundenlohn, zaehler: hoechstens } : stundenlohn;
};

/** A fraction of cents rounded to whole cents, half up: only for showing a rate, never for an amount */
export const centGerundet = ({ zaehler, nenner }: Bruch): number =>
  Number((2n * zaehler + nenner) / (2n * nenner));
