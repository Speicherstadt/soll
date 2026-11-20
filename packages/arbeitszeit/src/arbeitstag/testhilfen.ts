import { expect } from "vitest";
import { type Arbeitstag, arbeitstage } from "./arbeitstag.ts";
import type { Stempelart, Stempelung } from "./stempelungen.ts";

/*
 * Helpers for the tests of the working day. Wall-clock times carry their UTC offset, so every DST
 * case states which side of the change it is on.
 */
export const um = (text: string) => Date.parse(text);
const s = (art: Stempelart, text: string): Stempelung => ({ art, zeitpunkt: um(text) });
export const kommen = (text: string) => s("kommen", text);
export const gehen = (text: string) => s("gehen", text);
export const pause = (text: string) => s("pause_beginn", text);
export const weiter = (text: string) => s("pause_ende", text);

export const SPAETER = um("2030-01-01T00:00:00Z");

export const tage = (stempelungen: Stempelung[], jetzt = SPAETER): Arbeitstag[] => {
  const ergebnis = arbeitstage(stempelungen, jetzt);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};
export const einTag = (stempelungen: Stempelung[], jetzt = SPAETER): Arbeitstag => {
  const alle = tage(stempelungen, jetzt);
  expect(alle).toHaveLength(1);
  return alle[0] as Arbeitstag;
};
export const arten = (tag: Arbeitstag) => tag.befunde.map((befund) => befund.art);
