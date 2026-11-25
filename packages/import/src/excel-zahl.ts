/*
 * Dates and times as Excel stores them (ECMA-376 Part 1, 18.17.4): a serial number of days, its
 * fraction the time of day. In the 1900 system day 1 is 1 January 1900 and day 60 is 29 February
 * 1900, a day that never was (kept from Lotus 1-2-3), so every day from 1 March 1900 on is one more
 * than it would be; in the 1904 system day 0 is 1 January 1904. The number is read from its decimal
 * text with integers only (CLAUDE.md: no floats for time) and rounded to the second.
 */

/** Whole days and the seconds of the day after them */
export type Seriell = { tage: number; sekunden: number };

const SEKUNDEN_PRO_TAG = 86_400n;

/** A non-negative decimal like `46266`, `0.3125` or `4.6266E4`, as days and rounded seconds */
export const seriellAus = (text: string): Seriell | null => {
  const teile = /^(\d{1,15})(?:\.(\d{1,20}))?(?:[eE]([+-]?\d{1,2}))?$/.exec(text.trim());
  if (!teile) return null;
  const nachkomma = teile[2] ?? "";
  const exponent = Number(teile[3] ?? "0") - nachkomma.length;
  const ziffern = BigInt(`${teile[1]}${nachkomma}`);
  const zaehler = exponent >= 0 ? ziffern * 10n ** BigInt(exponent) : ziffern;
  const nenner = exponent >= 0 ? 1n : 10n ** BigInt(-exponent);
  const tage = zaehler / nenner;
  // round half up: (2 · rest · 86400 + nenner) / (2 · nenner)
  const sekunden = ((zaehler % nenner) * SEKUNDEN_PRO_TAG * 2n + nenner) / (2n * nenner);
  const ganz = { tage: tage + sekunden / SEKUNDEN_PRO_TAG, sekunden: sekunden % SEKUNDEN_PRO_TAG };
  // 2958465 is 31 December 9999, the last day Excel knows
  return ganz.tage > 2_958_465n
    ? null
    : { tage: Number(ganz.tage), sekunden: Number(ganz.sekunden) };
};

const TAG_MS = 86_400_000;
const NULLTAG_1900 = Date.UTC(1899, 11, 31);
const NULLTAG_1904 = Date.UTC(1904, 0, 1);

/** The calendar day `YYYY-MM-DD` of a serial day, or null for day 0 and the 29 February 1900 */
export const tagAusSeriell = (tage: number, system1904 = false): string | null => {
  if (system1904) return new Date(NULLTAG_1904 + tage * TAG_MS).toISOString().slice(0, 10);
  if (tage < 1 || tage === 60) return null;
  const echt = tage > 60 ? tage - 1 : tage;
  return new Date(NULLTAG_1900 + echt * TAG_MS).toISOString().slice(0, 10);
};

/** A time `H:MM:SS` from seconds; past a day the hours go on (a duration of 25:00:00) */
export const uhrAusSekunden = (sekunden: number): string => {
  const zwei = (n: number) => String(n).padStart(2, "0");
  const stunden = Math.floor(sekunden / 3600);
  return `${stunden}:${zwei(Math.floor((sekunden % 3600) / 60))}:${zwei(sekunden % 60)}`;
};

export type Zahlformat = "zahl" | "datum" | "zeit" | "datumzeit";

/** The built-in number formats that show a date or a time (ECMA-376 Part 1, 18.8.30) */
const EINGEBAUT: Record<number, Zahlformat> = {
  14: "datum",
  15: "datum",
  16: "datum",
  17: "datum",
  18: "zeit",
  19: "zeit",
  20: "zeit",
  21: "zeit",
  22: "datumzeit",
  45: "zeit",
  46: "zeit",
  47: "zeit",
  ...Object.fromEntries(
    [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58].map((id) => [
      id,
      "datum" as const,
    ]),
  ),
};

/**
 * What a format code shows: text in quotes, escaped characters and `[Red]` or `[$-407]` say nothing;
 * `[h]` (elapsed hours) does. `m` alone is a month or a minute, so `d` and `y` decide the date
 */
export const formatArt = (id: number, code: string | undefined): Zahlformat => {
  if (code === undefined) return EINGEBAUT[id] ?? "zahl";
  const kern = code
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/\[(?![hms]+\])[^\]]*\]/gi, "")
    .split(";")[0] as string;
  const datum = /[dy]/i.test(kern);
  const zeit = /[hs]/i.test(kern);
  if (datum && zeit) return "datumzeit";
  return datum ? "datum" : zeit ? "zeit" : "zahl";
};

/** The text of a number cell in a date or time format, as the readers of values take it */
export const zellText = (wert: string, art: Zahlformat, system1904: boolean): string => {
  const seriell = art === "zahl" ? null : seriellAus(wert);
  if (!seriell) return wert;
  const tag = tagAusSeriell(seriell.tage, system1904);
  if (art === "zeit" || tag === null)
    return uhrAusSekunden(seriell.tage * 86_400 + seriell.sekunden);
  if (art === "datum" && seriell.sekunden === 0) return tag;
  return `${tag} ${uhrAusSekunden(seriell.sekunden)}`;
};
