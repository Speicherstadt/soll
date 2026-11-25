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

/**
 * Whether an entry of the offline queue (S-803) finds the terminal locked: the short waits pace the
 * typing at the tablet and mean nothing for entries that arrive together, so only the lock until
 * midnight counts, and only for a credential that can be guessed (a PIN, a card with a PIN); a QR
 * code or a SUN message cannot be guessed and is compared even then, so honest stamps behind a
 * queue of guesses are not held back (review of S-803)
 */
export const offlineGesperrt = (stand: Sperrstand, jetzt: number, erratbar: boolean): boolean =>
  erratbar &&
  istGesperrt(stand, jetzt) &&
  stand.sperren * FEHLVERSUCHE_BIS_SPERRE >= FEHLVERSUCHE_JE_TAG;
