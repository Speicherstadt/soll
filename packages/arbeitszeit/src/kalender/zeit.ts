import { plusTage, type Tag } from "./tag.ts";

/**
 * Instants are UTC milliseconds, calendar days are counted in Europe/Berlin (CLAUDE.md, "Time").
 * These two functions are the only bridge between them. The parts are read one by one rather than
 * from a formatted string, so neither a locale's date pattern nor a year below 1000 can change the
 * shape of a Tag.
 */
const berlin = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const SEKUNDE = 1_000;

/** The Berlin wall clock of an instant, as numbers */
const ortszeit = (ms: number) => {
  const teile = berlin.formatToParts(ms);
  const teil = (art: Intl.DateTimeFormatPartTypes) =>
    Number(teile.find((kandidat) => kandidat.type === art)?.value);
  return {
    jahr: teil("year"),
    monat: teil("month"),
    tag: teil("day"),
    sekunden: teil("hour") * 3600 + teil("minute") * 60 + teil("second"),
  };
};

const zwei = (zahl: number) => String(zahl).padStart(2, "0");

/** The Berlin calendar day an instant falls on */
export const tagInBerlin = (ms: number): Tag => {
  const { jahr, monat, tag } = ortszeit(ms);
  return `${String(jahr).padStart(4, "0")}-${zwei(monat)}-${zwei(tag)}`;
};

/** How far Berlin's wall clock is ahead of UTC at an instant, in milliseconds (whole seconds) */
const abstand = (ms: number): number => {
  const { jahr, monat, tag, sekunden } = ortszeit(ms);
  const wanduhr = new Date(0).setUTCFullYear(jahr, monat - 1, tag) + sekunden * SEKUNDE;
  return wanduhr - (ms - (((ms % SEKUNDE) + SEKUNDE) % SEKUNDE));
};

/**
 * The instant a Berlin calendar day begins: UTC midnight of that day minus Berlin's offset, taken
 * a second time at the result in case the offset differs there. Midnight is never skipped or
 * repeated in Germany (the clocks change at 2:00 and 3:00); the offset is one or two hours today,
 * but was three in 1947 and Berlin's local mean time (0:53:28) before April 1893 (tz database).
 */
export const beginnInBerlin = (tag: Tag): number => {
  const mitternachtUtc = Date.parse(`${tag}T00:00:00Z`);
  const beginn = mitternachtUtc - abstand(mitternachtUtc - abstand(mitternachtUtc));
  if (tagInBerlin(beginn) !== tag || tagInBerlin(beginn - 1) !== plusTage(tag, -1))
    throw new Error(`no midnight in Berlin for ${tag}`);
  return beginn;
};
