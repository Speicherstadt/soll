import { plusTage, type Tag } from "../kalender/tag.ts";
import type { Abwesenheit, Abwesenheitsart } from "../soll/typen.ts";

/**
 * An absence as it is entered (S-401): a span of days, both included, whose first and last day may
 * be half; an open end (`bis` null) for a sickness whose end is not known yet. Sickness keeps only
 * whether a certificate is there, Kind krank a short id of the child (Art. 5, 9 DSGVO).
 */
export type Abwesenheitszeitraum = {
  art: Abwesenheitsart;
  von: Tag;
  bis: Tag | null;
  ersterHalb?: boolean;
  letzterHalb?: boolean;
  bescheinigung?: boolean;
  kind?: string | null;
};

/** The last day a span counts: its end, or for an open one the day given (today) */
const letzterTag = (zeitraum: Abwesenheitszeitraum, offenBis: Tag | null): Tag | null =>
  zeitraum.bis ?? offenBis;

/**
 * The days of a span as `tagesSoll` takes them: one entry per day, half on the first or last day as
 * entered (a single day is half when either is set). An open span counts up to `offenBis`.
 */
export const tageDesZeitraums = (
  zeitraum: Abwesenheitszeitraum,
  offenBis: Tag | null = null,
): Abwesenheit[] => {
  const bis = letzterTag(zeitraum, offenBis);
  if (bis === null || bis < zeitraum.von) return [];
  const tage: Abwesenheit[] = [];
  for (let tag = zeitraum.von; tag <= bis; tag = plusTage(tag, 1)) {
    const halb =
      (tag === zeitraum.von && zeitraum.ersterHalb === true) ||
      (tag === zeitraum.bis && zeitraum.letzterHalb === true);
    tage.push({
      tag,
      art: zeitraum.art,
      ...(halb ? { halb: true } : {}),
      ...(zeitraum.bescheinigung === true ? { bescheinigung: true } : {}),
      ...(zeitraum.kind ? { kind: zeitraum.kind } : {}),
    });
  }
  return tage;
};

/** Whether two spans share a day; an open end reaches on without limit */
type Spanne = { von: Tag; bis: Tag | null };

export const tageUeberschneiden = (a: Spanne, b: Spanne): boolean =>
  (a.bis === null || b.von <= a.bis) && (b.bis === null || a.von <= b.bis);

/**
 * Only sickness may fall into leave (§ 9 BUrlG, R-24: `tagesSoll` decides which counts); any other
 * two absences on the same day are no valid entry
 */
export const ueberschneidungErlaubt = (a: Abwesenheitsart, b: Abwesenheitsart): boolean =>
  (a === "krank" && b === "urlaub") || (a === "urlaub" && b === "krank");
