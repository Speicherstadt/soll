import { plusTage, type Tag } from "./tag.ts";

/**
 * Instants are UTC milliseconds, calendar days are counted in Europe/Berlin (CLAUDE.md, "Time").
 * These two functions are the only bridge between them.
 */
const berlin = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Berlin calendar day an instant falls on */
export const tagInBerlin = (ms: number): Tag => berlin.format(ms);

const STUNDE = 3_600_000;

/**
 * The instant a Berlin calendar day begins. Midnight is never skipped or repeated in Germany (the
 * clocks change at 2:00 and 3:00), and Berlin is one or two hours ahead of UTC, so the start is the
 * one of those two candidates that already lies on the day while the millisecond before does not.
 */
export const beginnInBerlin = (tag: Tag): number => {
  const mitternachtUtc = Date.parse(`${tag}T00:00:00Z`);
  const kandidaten = [mitternachtUtc - 2 * STUNDE, mitternachtUtc - STUNDE];
  const beginn = kandidaten.find(
    (ms) => tagInBerlin(ms) === tag && tagInBerlin(ms - 1) === plusTage(tag, -1),
  );
  if (beginn === undefined) throw new Error(`no midnight in Berlin for ${tag}`);
  return beginn;
};
