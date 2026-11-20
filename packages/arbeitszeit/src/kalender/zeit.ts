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
  era: "short",
});

const SEKUNDE = 1_000;

/** The Berlin wall clock of an instant, as numbers */
const ortszeit = (ms: number) => {
  const teile = berlin.formatToParts(ms);
  const teil = (art: Intl.DateTimeFormatPartTypes) =>
    Number(teile.find((kandidat) => kandidat.type === art)?.value);
  // Intl counts years in eras: the year 0 is "1 BC"; a Tag counts it as 0000 (ISO 8601)
  const vorChristus = teile.find((kandidat) => kandidat.type === "era")?.value === "BC";
  return {
    jahr: vorChristus ? 1 - teil("year") : teil("year"),
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

const STUNDE = 3_600_000;

/**
 * The instant a Berlin calendar day begins: UTC midnight of that day minus Berlin's offset at that
 * instant. The offset is one or two hours today, but was three in 1947 and Berlin's local mean time
 * (0:53:28) before April 1893 (tz database), so the offsets in force from three hours before to UTC
 * midnight are all tried, and the earliest instant that starts the day wins: on 1 October 1916 the
 * clocks went back at 1:00 and midnight came twice (tz database, Rule C-Eur 1916).
 */
export const beginnInBerlin = (tag: Tag): number => {
  const mitternachtUtc = Date.parse(`${tag}T00:00:00Z`);
  const vortag = plusTage(tag, -1);
  const beginne = [3, 2, 1, 0]
    .map((stunden) => mitternachtUtc - abstand(mitternachtUtc - stunden * STUNDE))
    .filter((kandidat) => tagInBerlin(kandidat) === tag && tagInBerlin(kandidat - 1) === vortag);
  if (beginne.length === 0) throw new Error(`no midnight in Berlin for ${tag}`);
  return Math.min(...beginne);
};

const MINUTE = 60_000;

/**
 * The instant of a Berlin wall-clock time: `minuten` after 0:00 on the clock of `tag` (0 to 1440,
 * 1440 is the next midnight). In the hour that comes twice in October it is the first; a time the
 * clocks skip in March (2:30) is counted in real minutes from midnight (3:30 CEST). The Nachtzeit of
 * § 2 Abs. 3 ArbZG and a moved Sunday rest (§ 9 Abs. 2 ArbZG) are wall-clock times.
 */
export const zeitpunktInBerlin = (tag: Tag, minuten: number): number => {
  if (minuten >= 24 * 60) return beginnInBerlin(plusTage(tag, 1)) + (minuten - 24 * 60) * MINUTE;
  const schaetzung = beginnInBerlin(tag) + minuten * MINUTE;
  const passend = [-STUNDE, 0, STUNDE]
    .map((verschiebung) => schaetzung + verschiebung)
    .filter((kandidat) => {
      const uhr = ortszeit(kandidat);
      return tagInBerlin(kandidat) === tag && uhr.sekunden === minuten * 60;
    });
  return passend.length === 0 ? schaetzung : Math.min(...passend);
};
