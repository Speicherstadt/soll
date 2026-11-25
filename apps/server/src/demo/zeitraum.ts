import {
  ersterTag,
  feiertageZwischen,
  letzterTag,
  type Monat,
  monatVon,
  plusMonate,
  plusTage,
  type Tag,
  wochentag,
  zeitpunktInBerlin,
} from "@soll/arbeitszeit";

/**
 * The span of the demo (BAULISTE.md S-909): the three full months before the month of `heute` and
 * that month up to `heute`. Pure functions on calendar days in Europe/Berlin (CLAUDE.md, "Time").
 */
export type Zeitraum = {
  heute: Tag;
  /** the first day with data: the first of the month three months before `heute`'s */
  beginn: Tag;
  /** the three full months, oldest first; each is confirmed and closed */
  volleMonate: readonly Monat[];
  /** the instant the demo stops: `heute` at 10:30, some people are at work */
  ende: number;
};

/** 10:30 on `heute`: the morning shifts are clocked in, nothing of the afternoon happened yet */
export const ENDE_MINUTE = 10 * 60 + 30;

export const zeitraumVon = (heute: Tag): Zeitraum => {
  const monat = monatVon(heute);
  const volleMonate = [3, 2, 1].map((n) => plusMonate(monat, -n));
  return {
    heute,
    beginn: ersterTag(volleMonate[0] as Monat),
    volleMonate,
    ende: zeitpunktInBerlin(heute, ENDE_MINUTE),
  };
};

/** Every day from `von` to `bis`, both included */
export const tageVon = (von: Tag, bis: Tag): Tag[] => {
  const tage: Tag[] = [];
  for (let tag = von; tag <= bis; tag = plusTage(tag, 1)) tage.push(tag);
  return tage;
};

/** The days of the demo, from its beginning to `heute` */
export const tageDes = (zeitraum: Zeitraum): Tag[] => tageVon(zeitraum.beginn, zeitraum.heute);

/** The public holidays in Hamburg in the span (both businesses are in Hamburg) */
export const feiertageInHamburg = (von: Tag, bis: Tag): ReadonlySet<Tag> => {
  const ergebnis = feiertageZwischen({ land: "HH" }, von, bis);
  return new Set(ergebnis.ok ? ergebnis.feiertage.map((f) => f.tag) : []);
};

/** The weekday as in ISO 8601: 1 Monday … 7 Sunday (the order of a model's `sollMinuten`) */
export const isoWochentag = (tag: Tag): number => ((wochentag(tag) + 6) % 7) + 1;

/** The n-th (1-based) day of a month with ISO weekday `wt` */
export const nterWochentag = (monat: Monat, wt: number, n: number): Tag => {
  const erster = ersterTag(monat);
  const abstand = (wt - isoWochentag(erster) + 7) % 7;
  return plusTage(erster, abstand + (n - 1) * 7);
};

/** The last day of a month with ISO weekday `wt` */
export const letzterWochentag = (monat: Monat, wt: number): Tag => {
  const letzter = letzterTag(monat);
  return plusTage(letzter, -((isoWochentag(letzter) - wt + 7) % 7));
};

/** A wall-clock time in Berlin on a day, as an instant; minutes past 24:00 run into the next day */
export const um = (tag: Tag, stunde: number, minute = 0): number =>
  zeitpunktInBerlin(tag, stunde * 60 + minute);
