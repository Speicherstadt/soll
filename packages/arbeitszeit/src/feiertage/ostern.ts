import { type Tag, tagAus } from "../kalender/tag.ts";

/**
 * Easter Sunday after Gauß in Lichtenberg's form (H. Lichtenberg, Zur Interpretation der Gaußschen
 * Osterformel und ihrer Ausnahmeregeln, Historia Mathematica 24, 1997), which folds Gauß's two
 * exceptions into the formula. Integer arithmetic only. Null outside 1583 (the first whole Gregorian
 * year; before, Easter followed the Julian calendar) to 9999 (the last year of a `YYYY-MM-DD` day).
 */
export const ostersonntag = (jahr: number): Tag | null => {
  if (!Number.isInteger(jahr) || jahr < 1583 || jahr > 9999) return null;
  const k = Math.floor(jahr / 100); // secular number
  const m = 15 + Math.floor((3 * k + 3) / 4) - Math.floor((8 * k + 13) / 25); // secular moon shift
  const s = 2 - Math.floor((3 * k + 3) / 4); // secular sun shift
  const a = jahr % 19; // moon parameter
  const d = (19 * a + m) % 30; // seed of the first full moon in spring
  const r = Math.floor((d + Math.floor(a / 11)) / 29); // calendar correction
  const og = 21 + d - r; // Easter limit: day of March of the full moon
  const sz = 7 - ((jahr + Math.floor(jahr / 4) + s) % 7); // first Sunday in March
  const oe = 7 - ((og - sz) % 7); // distance of Easter Sunday from the Easter limit
  return tagAus(jahr, 3, og + oe); // day of March, past 31 rolls into April
};
