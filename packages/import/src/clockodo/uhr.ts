import { minuteInBerlin, type Tag, tagInBerlin } from "@soll/arbeitszeit";

/*
 * The Berlin wall clock of many instants, fast (BAULISTE.md S-703: 20,000 entries within 1 s).
 * Berlin's offset is whole hours since 1893 and changes only at the start of a UTC hour, so the
 * clock of an hour's start is asked once and the minutes inside it are added.
 */

const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;

export type Wanduhr = { tag: Tag; minute: number };

export const berlinerUhr = () => {
  const stunden = new Map<number, Wanduhr>();
  const stundeVon = (start: number): Wanduhr => {
    const bekannt = stunden.get(start);
    if (bekannt) return bekannt;
    const uhr = { tag: tagInBerlin(start), minute: minuteInBerlin(start) };
    stunden.set(start, uhr);
    return uhr;
  };
  /** The clock of an instant on a whole minute */
  const uhr = (ms: number): Wanduhr => {
    const start = Math.floor(ms / STUNDE) * STUNDE;
    const { tag, minute } = stundeVon(start);
    return { tag, minute: minute + (ms - start) / MINUTE };
  };
  /**
   * Whether the clock showed the same time an hour before: the second pass of the hour that comes
   * twice in October, which a day and a minute cannot name (the planner takes the first)
   */
  const doppelt = (ms: number): boolean => {
    const jetzt = uhr(ms);
    const vorher = uhr(ms - STUNDE);
    return jetzt.tag === vorher.tag && jetzt.minute === vorher.minute;
  };
  return { uhr, doppelt };
};
