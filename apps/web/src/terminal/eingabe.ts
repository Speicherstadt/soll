/** A key of the number pad: a digit, delete or confirm (DESIGN.md, "Ziffernfeld") */
export type Taste = { art: "ziffer"; ziffer: string } | { art: "loeschen" } | { art: "ok" };

/** A PIN has 6 to 8 digits (apps/server, modules/pin, istNeuePin) */
export const PIN_MIN = 6;
export const PIN_MAX = 8;

/** The PIN typed so far after one more key; confirming leaves it as it is */
export const pinNach = (pin: string, taste: Taste): string => {
  if (taste.art === "loeschen") return pin.slice(0, -1);
  if (taste.art === "ziffer" && pin.length < PIN_MAX && /^\d$/.test(taste.ziffer))
    return pin + taste.ziffer;
  return pin;
};

export const pinVollstaendig = (pin: string): boolean => pin.length >= PIN_MIN;

/** A key from the keyboard, so the pad works without touch too */
export const tasteAus = (key: string): Taste | null => {
  if (/^\d$/.test(key)) return { art: "ziffer", ziffer: key };
  if (key === "Backspace" || key === "Delete") return { art: "loeschen" };
  if (key === "Enter") return { art: "ok" };
  return null;
};

/** A pairing code as shown and typed: two groups of four, e.g. ABCD-EFGH */
export const codeAnzeige = (code: string): string => {
  const rein = code.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return rein.length > 4 ? `${rein.slice(0, 4)}-${rein.slice(4, 8)}` : rein;
};

/** Whole seconds left until an instant, never below zero, rounded up so 0 means over */
export const sekundenBis = (bis: number, jetzt: number): number =>
  Math.max(0, Math.ceil((bis - jetzt) / 1000));

/**
 * Whether a lock is the one until midnight after the day's last wrong try rather than one of a few
 * minutes (apps/server, modules/terminal/sperre.ts: the longest short lock is four minutes)
 */
export const sperreBisMitternacht = (bis: number, jetzt: number): boolean =>
  sekundenBis(bis, jetzt) > 4 * 60;
