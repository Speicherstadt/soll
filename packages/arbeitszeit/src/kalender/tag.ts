/**
 * Calendar days as text `YYYY-MM-DD` (CLAUDE.md, "Time"). The arithmetic runs on whole days in UTC, so
 * no time zone or DST change can shift a day.
 */
export type Tag = string;

const MS_PRO_TAG = 86_400_000;

const zwei = (zahl: number): string => String(zahl).padStart(2, "0");

/** UTC milliseconds of a day; setUTCFullYear because Date.UTC maps the years 0 to 99 onto 1900 to 1999 */
const msAus = (jahr: number, monat: number, tagImMonat: number): number =>
  new Date(0).setUTCFullYear(jahr, monat - 1, tagImMonat);

/** The day of a year, month (1 to 12) and day of month */
export const tagAus = (jahr: number, monat: number, tagImMonat: number): Tag => {
  const datum = new Date(msAus(jahr, monat, tagImMonat));
  return `${String(datum.getUTCFullYear()).padStart(4, "0")}-${zwei(datum.getUTCMonth() + 1)}-${zwei(datum.getUTCDate())}`;
};

const alsMs = (tag: Tag): number => {
  const [jahr, monat, tagImMonat] = tag.split("-").map(Number);
  return msAus(jahr ?? 0, monat ?? 1, tagImMonat ?? 1);
};

export const plusTage = (tag: Tag, tage: number): Tag => {
  const datum = new Date(alsMs(tag) + tage * MS_PRO_TAG);
  return tagAus(datum.getUTCFullYear(), datum.getUTCMonth() + 1, datum.getUTCDate());
};

/** 0 Sunday to 6 Saturday */
export const wochentag = (tag: Tag): number => new Date(alsMs(tag)).getUTCDay();

/** True for a real calendar day written as `YYYY-MM-DD` (not 2026-02-30, not 2026-13-01) */
export const istTag = (text: string): boolean => {
  const teile = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!teile) return false;
  return tagAus(Number(teile[1]), Number(teile[2]), Number(teile[3])) === text;
};

export const jahrVon = (tag: Tag): number => Number(tag.slice(0, 4));
