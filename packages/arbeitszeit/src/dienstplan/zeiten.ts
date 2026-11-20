import { plusTage, type Tag } from "../kalender/tag.ts";
import { eingabeInBerlin, minuteInBerlin } from "../kalender/wanduhr.ts";

/** A span of a planned shift in UTC milliseconds */
export type Zeitspanne = { beginn: number; ende: number };

const MINUTE = 60_000;

/**
 * The instants of a shift typed as a day and two times on the Berlin clock. An end at or before the
 * beginning lies on the next day: the shift belongs to the day it begins on (docs/plan.md, "Schicht
 * und Arbeitstag"). A time the clocks skip in March does not exist and gives null, as does an end
 * equal to the beginning (no shift, or one of 24 hours, which § 3 ArbZG never allows); of the hour
 * that comes twice in October the first counts, as when a time is typed for a stamp.
 */
export const schichtZeiten = (
  tag: Tag,
  beginnMinute: number,
  endeMinute: number,
): Zeitspanne | null => {
  if (beginnMinute === endeMinute) return null;
  const beginn = eingabeInBerlin(tag, beginnMinute);
  const ende = eingabeInBerlin(endeMinute > beginnMinute ? tag : plusTage(tag, 1), endeMinute);
  return beginn === null || ende === null ? null : { beginn, ende };
};

/** The times of a shift on the Berlin clock, as typed */
export const uhrzeitenVon = (spanne: Zeitspanne) => ({
  beginnMinute: minuteInBerlin(spanne.beginn),
  endeMinute: minuteInBerlin(spanne.ende),
});

/** The working minutes of a shift: real minutes from beginning to end, without the break */
export const schichtMinuten = (schicht: Zeitspanne & { pauseMinuten: number }): number =>
  Math.round((schicht.ende - schicht.beginn) / MINUTE) - schicht.pauseMinuten;

/**
 * A shift moved to another day keeps its times on the clock, not its length: 22:00 to 6:00 stays
 * 22:00 to 6:00 in the night the clocks change, and is an hour shorter or longer there
 */
export const verschoben = (spanne: Zeitspanne, tag: Tag): Zeitspanne | null => {
  const { beginnMinute, endeMinute } = uhrzeitenVon(spanne);
  return schichtZeiten(tag, beginnMinute, endeMinute);
};
