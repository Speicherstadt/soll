import { beginnInBerlin, plusTage, tagInBerlin } from "@soll/arbeitszeit";

/**
 * The lock of a terminal against guessing PINs (docs/plan.md, "Sperre am Terminal"): after every
 * five wrong tries of a calendar day it waits, one minute, then two, then four; the twentieth wrong
 * try of the day locks it until midnight (Europe/Berlin). A person recognised lifts nothing, or
 * whoever stands at the tablet could type their own PIN between guesses. Pure functions on the
 * stored state.
 */
export const FEHLVERSUCHE_BIS_SPERRE = 5;
export const ERSTE_SPERRE_MS = 60_000;
/** Wrong tries a terminal compares in a day: with PINs of six digits, 20 × people / 10⁶ to hit one */
export const FEHLVERSUCHE_JE_TAG = 20;

export type Sperrstand = {
  fehlversuche: number;
  sperren: number;
  gesperrtBis: number | null;
  /** the calendar day the counts belong to */
  fehlerTag: string | null;
};

export const istGesperrt = (stand: Sperrstand, jetzt: number): boolean =>
  stand.gesperrtBis !== null && stand.gesperrtBis > jetzt;

export const nachFehlversuch = (stand: Sperrstand, jetzt: number): Sperrstand => {
  const tag = tagInBerlin(jetzt);
  const heute = stand.fehlerTag === tag ? stand : { ...stand, fehlversuche: 0, sperren: 0 };
  const fehlversuche = heute.fehlversuche + 1;
  if (fehlversuche < FEHLVERSUCHE_BIS_SPERRE) return { ...heute, fehlversuche, fehlerTag: tag };
  const sperren = heute.sperren + 1;
  const gesperrtBis =
    sperren * FEHLVERSUCHE_BIS_SPERRE >= FEHLVERSUCHE_JE_TAG
      ? beginnInBerlin(plusTage(tag, 1))
      : jetzt + ERSTE_SPERRE_MS * 2 ** heute.sperren;
  return { fehlversuche: 0, sperren, gesperrtBis, fehlerTag: tag };
};
