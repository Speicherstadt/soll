/**
 * The lock of a terminal against guessing PINs and QR codes (docs/plan.md, "Sperre am Terminal"):
 * after five wrong tries in a row it waits one minute, each further lock twice as long as the last,
 * at most 15 minutes; a person recognised ends it. Pure functions on the stored state.
 */
export const FEHLVERSUCHE_BIS_SPERRE = 5;
export const ERSTE_SPERRE_MS = 60_000;
export const LAENGSTE_SPERRE_MS = 15 * 60_000;

export type Sperrstand = { fehlversuche: number; sperren: number; gesperrtBis: number | null };

export const istGesperrt = (stand: Sperrstand, jetzt: number): boolean =>
  stand.gesperrtBis !== null && stand.gesperrtBis > jetzt;

export const nachFehlversuch = (stand: Sperrstand, jetzt: number): Sperrstand => {
  const fehlversuche = stand.fehlversuche + 1;
  if (fehlversuche < FEHLVERSUCHE_BIS_SPERRE) return { ...stand, fehlversuche };
  const dauer = Math.min(ERSTE_SPERRE_MS * 2 ** stand.sperren, LAENGSTE_SPERRE_MS);
  return { fehlversuche: 0, sperren: stand.sperren + 1, gesperrtBis: jetzt + dauer };
};

export const OHNE_SPERRE: Sperrstand = { fehlversuche: 0, sperren: 0, gesperrtBis: null };

/** Whether a stand differs from one without any wrong try, so a success has something to reset */
export const mussZuruecksetzen = (stand: Sperrstand): boolean =>
  stand.fehlversuche !== 0 || stand.sperren !== 0 || stand.gesperrtBis !== null;
