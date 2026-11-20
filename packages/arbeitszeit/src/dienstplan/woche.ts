import { jahrVon, plusTage, type Tag, tageZwischen, wochenbeginn } from "../kalender/tag.ts";

export type Kalenderwoche = { jahr: number; nummer: number };

/**
 * The calendar week of a day after ISO 8601 (DIN 1355): weeks run Monday to Sunday, and the week of
 * a year's first Thursday is its week 1, so the Thursday decides the year
 */
export const kalenderwoche = (tag: Tag): Kalenderwoche => {
  const donnerstag = plusTage(wochenbeginn(tag), 3);
  const jahr = jahrVon(donnerstag);
  return { jahr, nummer: Math.floor(tageZwischen(`${jahr}-01-01`, donnerstag) / 7) + 1 };
};

/** The week of the plan around a day: Monday to Sunday, with its calendar week */
export const planWoche = (tag: Tag): { tage: Tag[]; kw: Kalenderwoche } => {
  const montag = wochenbeginn(tag);
  return {
    tage: Array.from({ length: 7 }, (_, index) => plusTage(montag, index)),
    kw: kalenderwoche(montag),
  };
};
