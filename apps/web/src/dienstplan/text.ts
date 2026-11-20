import { plusTage, type Tag } from "@soll/arbeitszeit";
import { getLocale } from "../paraglide/runtime.js";
import { uhrzeitText } from "../zeiten/text.ts";

/**
 * What the plan reads in the language of the app: times on Berlin's clock, digits Latin in every
 * language (DESIGN.md, "Texte"), days read at noon UTC so no time zone moves them
 */
const tagFormat = (optionen: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(getLocale(), { timeZone: "UTC", numberingSystem: "latn", ...optionen });

const mittag = (tag: Tag) => Date.parse(`${tag}T12:00:00Z`);

/** "14:00–22:00" for a shift, also over midnight */
export const spanneText = (spanne: { beginn: number; ende: number }): string =>
  `${uhrzeitText(spanne.beginn)}–${uhrzeitText(spanne.ende)}`;

const zwei = (zahl: number) => String(zahl).padStart(2, "0");

/** "14:00" for minutes after midnight, as `<input type="time">` takes it */
export const minutenText = (minuten: number): string =>
  `${zwei(Math.floor(minuten / 60))}:${zwei(minuten % 60)}`;

export const minutenSpanne = (beginn: number, ende: number): string =>
  `${minutenText(beginn)}–${minutenText(ende)}`;

/** "Mo" and "23." for the head of a column */
export const wochentagKurz = (tag: Tag): string =>
  tagFormat({ weekday: "short" }).format(mittag(tag));
export const tagDerZahl = (tag: Tag): string => tagFormat({ day: "numeric" }).format(mittag(tag));

/** "Montag, 23. November" for what a screen reader announces and the day on a phone */
export const tagLang = (tag: Tag): string =>
  tagFormat({ weekday: "long", day: "numeric", month: "long" }).format(mittag(tag));

/** "23.–29. November 2026" for the head of the week */
export const zeitraumText = (von: Tag, bis: Tag): string =>
  tagFormat({ day: "numeric", month: "long", year: "numeric" }).formatRange(
    mittag(von),
    mittag(bis),
  );

/** The name of a weekday 1 (Monday) to 7 (Sunday), from a Monday known to be one */
export const wochentagName = (iso: number): string =>
  tagFormat({ weekday: "long" }).format(mittag(plusTage("2026-11-23", iso - 1)));
