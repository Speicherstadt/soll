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

/** Hours, minutes and seconds of a clock, each in range, as minutes rounded as asked */
const minutenAus = (h: number, m: number, s: number, runden: Runden): number | null => {
  if (h > 23 || m > 59 || s > 59) return null;
  const minuten = h * 60 + m + (s > 0 && runden === "auf" ? 1 : 0);
  // 23:59:30 rounded up is midnight, the start of the next day
  return minuten % MINUTEN_PRO_TAG;
};

const uhrAllein = (wert: string, runden: Runden): number | null => {
  const uhr = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(wert);
  if (uhr) return minutenAus(Number(uhr[1]), Number(uhr[2]), Number(uhr[3] ?? "0"), runden);
  if (/^\d{1,2}$/.test(wert)) return minutenAus(Number(wert), 0, 0, runden);
  if (/^\d{3,4}$/.test(wert)) {
    const zahl = Number(wert);
    return minutenAus(Math.floor(zahl / 100), zahl % 100, 0, runden);
  }
  // a fraction of a day, as Excel stores a time: 0,3125 is 7:30
  const bruch = /^0?[.,](\d{1,20})$/.exec(wert);
  const seriell = bruch ? seriellAus(`0.${bruch[1]}`) : null;
  if (!seriell || seriell.tage > 0) return null;
  const s = seriell.sekunden;
  return minutenAus(Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60, runden);
};

/**
 * Minutes since midnight of a time of day; a day before it is ignored. Seconds round down for a
 * begin and up for an end, so the span is never shorter than the one recorded
 */
export const uhrzeitFrei = (text: string, runden: Runden): number | null => {
  const wert = text.trim();
  const teile = geteilt(wert);
  return uhrAllein(teile && tagFrei(teile.tag) ? teile.uhr : wert, runden);
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
