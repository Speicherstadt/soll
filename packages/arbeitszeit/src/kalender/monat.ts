import { istTag, plusTage, type Tag, tagAus } from "./tag.ts";

/**
 * Calendar months as text `YYYY-MM`: the period of a wage and of a monthly close (§ 1 MiLoG,
 * § 8 SGB IV). Like a Tag, a month is a Berlin calendar month, never an instant.
 */
export type Monat = string;

/** True for a real month written as `YYYY-MM` (not 2026-13) */
export const istMonat = (text: string): boolean =>
  /^\d{4}-\d{2}$/.test(text) && istTag(`${text}-01`);

export const monatVon = (tag: Tag): Monat => tag.slice(0, 7);

export const ersterTag = (monat: Monat): Tag => `${monat}-01`;

/** The month `anzahl` months later, negative backwards */
export const plusMonate = (monat: Monat, anzahl: number): Monat => {
  const [jahr = 0, nummer = 1] = monat.split("-").map(Number);
  return monatVon(tagAus(jahr, nummer + anzahl, 1));
};

export const letzterTag = (monat: Monat): Tag => plusTage(ersterTag(plusMonate(monat, 1)), -1);
