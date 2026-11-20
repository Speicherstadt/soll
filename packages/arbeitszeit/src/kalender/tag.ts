/**
 * Calendar days as text `YYYY-MM-DD` (CLAUDE.md, "Time"). The arithmetic runs on whole days in UTC, so
 * no time zone or DST change can shift a day.
 */
export type Tag = string;

const MS_PRO_TAG = 86_400_000;

const zwei = (zahl: number): string => String(zahl).padStart(2, "0");

/** The day of a year, month (1 to 12) and day of month */
export const tagAus = (jahr: number, monat: number, tagImMonat: number): Tag => {
  const datum = new Date(Date.UTC(jahr, monat - 1, tagImMonat));
  return `${String(datum.getUTCFullYear()).padStart(4, "0")}-${zwei(datum.getUTCMonth() + 1)}-${zwei(datum.getUTCDate())}`;
};

const alsMs = (tag: Tag): number => {
  const [jahr, monat, tagImMonat] = tag.split("-").map(Number);
  return Date.UTC(jahr ?? 0, (monat ?? 1) - 1, tagImMonat ?? 1);
};

export const plusTage = (tag: Tag, tage: number): Tag => {
  const datum = new Date(alsMs(tag) + tage * MS_PRO_TAG);
  return tagAus(datum.getUTCFullYear(), datum.getUTCMonth() + 1, datum.getUTCDate());
};

/** 0 Sunday to 6 Saturday */
export const wochentag = (tag: Tag): number => new Date(alsMs(tag)).getUTCDay();

export const jahrVon = (tag: Tag): number => Number(tag.slice(0, 4));
