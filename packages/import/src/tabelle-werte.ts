import { istTag } from "@soll/arbeitszeit";
import { seriellAus, tagAusSeriell } from "./excel-zahl.ts";

/*
 * The values of a spreadsheet as people in Germany type them and Excel saves them (BAULISTE.md
 * S-702): days as `01.09.2026`, `1.9.26`, `2026-09-01` or an Excel serial number, times as `7:00`,
 * `07:00:00`, `700` or a fraction of a day, durations as `7,5` hours or `7:30`, breaks in minutes.
 * Whole minutes from integers only (CLAUDE.md: no floats for time). What is none of these is null,
 * never a guess; the reader names the line and the column instead. Where seconds or fractions of a
 * minute must go, they go in the person's favour (CLAUDE.md: never round to their disadvantage).
 */

const zwei = (text: string): string => text.padStart(2, "0");

/** The parts of `01.09.2026 07:00` or `2026-09-01T07:00:00`: a day and a time, or the whole */
const geteilt = (text: string): { tag: string; uhr: string } | null => {
  const teile = /^(\S+)[ T](\S+)$/.exec(text);
  return teile ? { tag: teile[1] as string, uhr: teile[2] as string } : null;
};

const tagAllein = (wert: string): string | null => {
  const deutsch = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(wert);
  if (deutsch) {
    const jahr = deutsch[3]?.length === 2 ? `20${deutsch[3]}` : deutsch[3];
    const tag = `${jahr}-${zwei(deutsch[2] ?? "")}-${zwei(deutsch[1] ?? "")}`;
    return istTag(tag) ? tag : null;
  }
  // an Excel serial number of five digits: 10000 is 18 May 1927, 99999 is 14 October 2173
  if (/^\d{5}$/.test(wert)) return tagAusSeriell(Number(wert));
  return istTag(wert) ? wert : null;
};

/** A calendar day `YYYY-MM-DD`; a time after the day is ignored */
export const tagFrei = (text: string): string | null => {
  const wert = text.trim();
  const teile = geteilt(wert);
  return tagAllein(teile ? teile.tag : wert);
};

export type Runden = "ab" | "auf";

const MINUTEN_PRO_TAG = 24 * 60;

/** Hours, minutes and seconds of a clock, each in range, as seconds since midnight */
const sekundenAus = (h: number, m: number, s: number): number | null =>
  h > 23 || m > 59 || s > 59 ? null : h * 3600 + m * 60 + s;

const uhrAllein = (wert: string): number | null => {
  const uhr = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(wert);
  if (uhr) return sekundenAus(Number(uhr[1]), Number(uhr[2]), Number(uhr[3] ?? "0"));
  if (/^\d{1,2}$/.test(wert)) return sekundenAus(Number(wert), 0, 0);
  if (/^\d{3,4}$/.test(wert)) {
    const zahl = Number(wert);
    return sekundenAus(Math.floor(zahl / 100), zahl % 100, 0);
  }
  // a fraction of a day, as Excel stores a time: 0,3125 is 7:30
  const bruch = /^0?[.,](\d{1,20})$/.exec(wert);
  const seriell = bruch ? seriellAus(`0.${bruch[1]}`) : null;
  return !seriell || seriell.tage > 0 ? null : seriell.sekunden;
};

/** Seconds since midnight of a time of day, as written; a day before it is ignored */
export const uhrSekunden = (text: string): number | null => {
  const wert = text.trim();
  const teile = geteilt(wert);
  return uhrAllein(teile && tagFrei(teile.tag) ? teile.uhr : wert);
};

/** Seconds of the day as whole minutes, down or up; 23:59:30 up is midnight, of the next day */
export const minutenVon = (sekunden: number, runden: Runden): number =>
  (runden === "ab" ? Math.floor(sekunden / 60) : Math.ceil(sekunden / 60)) % MINUTEN_PRO_TAG;

/**
 * Minutes since midnight of a time of day; a day before it is ignored. Seconds round down for a
 * begin and up for an end, so the span is never shorter than the one recorded
 */
export const uhrzeitFrei = (text: string, runden: Runden): number | null => {
  const sekunden = uhrSekunden(text);
  return sekunden === null ? null : minutenVon(sekunden, runden);
};

/** A duration that may lie between two whole minutes: the lower and the upper one */
export type Spanne = { ab: number; auf: number };

const LAENGSTE = 24 * 60;

const spanne = (ab: number, auf: number): Spanne | null => (auf <= LAENGSTE ? { ab, auf } : null);

/** `7:30` or `7:30:15` as hours, minutes and seconds */
const ausUhr = (wert: string): Spanne | null => {
  const teile = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(wert);
  if (!teile || Number(teile[2]) > 59 || Number(teile[3] ?? "0") > 59) return null;
  const minuten = Number(teile[1]) * 60 + Number(teile[2]);
  return spanne(minuten, minuten + (Number(teile[3] ?? "0") > 0 ? 1 : 0));
};

/** `7,5` or `.25` hours: numerator and denominator in integers, then down and up to a minute */
const ausDezimal = (wert: string): Spanne | null => {
  const teile = /^(\d{0,2})[.,](\d{1,6})$/.exec(wert);
  if (!teile) return null;
  const nenner = 10 ** (teile[2] as string).length;
  const zaehler = (Number(teile[1] || "0") * nenner + Number(teile[2])) * 60;
  return spanne(Math.floor(zaehler / nenner), Math.ceil(zaehler / nenner));
};

/** A span of work: whole hours (`8`), decimal hours (`7,5`) or `7:30` */
export const dauerFrei = (text: string): Spanne | null => {
  const wert = text.trim();
  if (/^\d{1,2}$/.test(wert)) return spanne(Number(wert) * 60, Number(wert) * 60);
  return ausUhr(wert) ?? ausDezimal(wert);
};

/**
 * A break: whole minutes (`30`), `0:30` or decimal hours (`0,5`); empty is none. A fraction of a
 * minute is dropped, so the break counts no longer than recorded
 */
export const pauseFrei = (text: string): number | null => {
  const wert = text.trim();
  if (wert === "") return 0;
  if (/^\d{1,4}$/.test(wert)) return Number(wert) <= LAENGSTE ? Number(wert) : null;
  return (ausUhr(wert) ?? ausDezimal(wert))?.ab ?? null;
};

/**
 * A duration exactly as written, in seconds as `wert / nenner`, and the unit of its last digit
 * (`einheit / nenner`): `8:01` is to the minute, `7:30:15` to the second, `7,5` to a tenth of an
 * hour; whole hours (`8`) count as written to the minute. A span agrees with it when it lies within
 * half that unit (review S-702, round 2)
 */
export type GenaueDauer = { wert: number; nenner: number; einheit: number };

export const dauerGenau = (text: string): GenaueDauer | null => {
  const wert = text.trim();
  if (dauerFrei(wert) === null) return null;
  if (/^\d{1,2}$/.test(wert)) return { wert: Number(wert) * 3600, nenner: 1, einheit: 60 };
  const uhr = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(wert);
  if (uhr) {
    const sekunden = Number(uhr[1]) * 3600 + Number(uhr[2]) * 60 + Number(uhr[3] ?? "0");
    return { wert: sekunden, nenner: 1, einheit: uhr[3] === undefined ? 60 : 1 };
  }
  const teile = /^(\d{0,2})[.,](\d{1,6})$/.exec(wert) as RegExpExecArray;
  const nenner = 10 ** (teile[2] as string).length;
  return {
    wert: (Number(teile[1] || "0") * nenner + Number(teile[2])) * 3600,
    nenner,
    einheit: 3600,
  };
};

/** Whether a span in seconds agrees with a duration within half the unit of its last digit */
export const dauerPasst = (sekunden: number, dauer: GenaueDauer): boolean =>
  Math.abs(sekunden * dauer.nenner - dauer.wert) * 2 <= dauer.einheit;
