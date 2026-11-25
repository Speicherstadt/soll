import { minuteInBerlin, type Tag, tagInBerlin } from "@soll/arbeitszeit";

/*
 * The Berlin wall clock of many instants, fast (20,000 records within 1 s; the same clock as
 * Clockodo's reader in S-703). Berlin's offset is whole hours since 1893 and changes only at the
 * start of a UTC hour, so the clock of an hour's start is asked once and the minutes inside it are
 * added; and on a UTC day whose first and last hour have the same offset, that offset holds for
 * the whole day, so the day is asked twice and every instant in it is computed (S-705: 20,000
 * timesheets of a year lie in 8,760 different hours, which the clock would otherwise ask one by one).
 */

const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;
const TAG = 24 * STUNDE;

export type Wanduhr = { tag: Tag; minute: number };

export const berlinerUhr = () => {
  const stunden = new Map<number, Wanduhr>();
  const tage = new Map<number, number | null>();
  const stundeVon = (start: number): Wanduhr => {
    const bekannt = stunden.get(start);
    if (bekannt) return bekannt;
    const uhr = { tag: tagInBerlin(start), minute: minuteInBerlin(start) };
    stunden.set(start, uhr);
    return uhr;
  };
  /** Berlin's offset at the start of a UTC hour, in milliseconds */
  const versatz = (start: number): number => {
    const { tag, minute } = stundeVon(start);
    return Date.parse(`${tag}T00:00:00Z`) + minute * MINUTE - start;
  };
  /** The offset of a whole UTC day, or null when it changes during the day */
  const tagesVersatz = (utcTag: number): number | null => {
    if (tage.has(utcTag)) return tage.get(utcTag) as number | null;
    const erster = versatz(utcTag * TAG);
    const wert = erster === versatz(utcTag * TAG + TAG - STUNDE) ? erster : null;
    tage.set(utcTag, wert);
    return wert;
  };
  /** The clock of an instant on a whole minute */
  const uhr = (ms: number): Wanduhr => {
    const ganzerTag = tagesVersatz(Math.floor(ms / TAG));
    if (ganzerTag !== null) {
      const lokal = ms + ganzerTag;
      const mitternacht = Math.floor(lokal / TAG) * TAG;
      return {
        tag: new Date(mitternacht).toISOString().slice(0, 10),
        minute: (lokal - mitternacht) / MINUTE,
      };
    }
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

export type BerlinerUhr = ReturnType<typeof berlinerUhr>;
