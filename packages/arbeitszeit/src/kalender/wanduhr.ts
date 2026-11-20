import { istTag, type Tag } from "./tag.ts";
import { beginnInBerlin, tagInBerlin } from "./zeit.ts";

/**
 * Wall-clock times in Europe/Berlin for what a person types or reads: a time of day as whole minutes
 * since midnight. The instant stays the truth (CLAUDE.md, "Time"); these only translate.
 */
const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;
const MINUTEN_PRO_TAG = 24 * 60;

const uhr = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The minute of the day an instant shows on a clock in Berlin, its seconds cut off */
export const minuteInBerlin = (ms: number): number => {
  const teile = uhr.formatToParts(ms);
  const teil = (art: Intl.DateTimeFormatPartTypes) =>
    Number(teile.find((kandidat) => kandidat.type === art)?.value);
  return teil("hour") * 60 + teil("minute");
};

/**
 * The instant a Berlin clock shows `minute` on `tag`. A time the clocks skip in spring has none
 * (null); of the hour that comes twice in October the first, in summer time, counts: whoever means
 * the second one corrects it afterwards, with a reason. The candidates are midnight plus the minutes
 * shifted by up to three hours either way, which covers every offset Berlin ever kept.
 */
export const eingabeInBerlin = (tag: Tag, minute: number): number | null => {
  if (!istTag(tag) || !Number.isInteger(minute) || minute < 0 || minute >= MINUTEN_PRO_TAG)
    return null;
  const mitternacht = beginnInBerlin(tag);
  const treffer = [-3, -2, -1, 0, 1, 2, 3]
    .map((stunden) => mitternacht + minute * MINUTE + stunden * STUNDE)
    .filter((kandidat) => tagInBerlin(kandidat) === tag && minuteInBerlin(kandidat) === minute);
  return treffer.length === 0 ? null : Math.min(...treffer);
};
