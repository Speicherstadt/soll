import { istTag } from "@soll/arbeitszeit";
import type { BerlinerUhr } from "../uhr.ts";

/*
 * The values of the time trackers' exports and APIs (BAULISTE.md S-707). The Detailed report of
 * Toggl Track and of Clockify writes dates and times in the format of the exporting person's
 * profile and in their time zone; Soll reads them in Europe/Berlin and takes only formats that say
 * one thing: `2026-09-01` and `01.09.2026` (`09/01/2026` may be the 1st of September or the 9th of
 * January) and times with 24 or 12 hours, with or without seconds. The APIs give instants in UTC
 * (Toggl `start`/`stop`, Clockify `timeInterval`), with `Z` or an offset.
 */

const SEKUNDE = 1000;
const MINUTE = 60 * SEKUNDE;
const STUNDE = 60 * MINUTE;

/** A day as the export writes it, or null: ISO or German, never one with slashes */
export const datumLesen = (text: string): string | null => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const deutsch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  const tag = iso
    ? `${iso[1]}-${iso[2]}-${iso[3]}`
    : deutsch
      ? `${deutsch[3]}-${(deutsch[2] as string).padStart(2, "0")}-${(deutsch[1] as string).padStart(2, "0")}`
      : null;
  return tag !== null && istTag(tag) ? tag : null;
};

/** A time of day in seconds since midnight, with 24 hours or with AM/PM, or null */
export const uhrzeitLesen = (text: string): number | null => {
  const teile = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?\s*[Mm]\.?)?$/.exec(text);
  if (!teile) return null;
  const stunde = Number(teile[1]);
  const minute = Number(teile[2]);
  const sekunde = Number(teile[3] ?? 0);
  if (minute > 59 || sekunde > 59) return null;
  const halb = teile[4]?.toLowerCase();
  if (halb === undefined) return stunde > 23 ? null : stunde * 3600 + minute * 60 + sekunde;
  if (stunde < 1 || stunde > 12) return null;
  const stunde24 = (stunde % 12) + (halb === "p" ? 12 : 0);
  return stunde24 * 3600 + minute * 60 + sekunde;
};

/**
 * The instant a Berlin clock shows on a day at a time in seconds, or null: a time the clocks skip
 * in spring has none, and one of the hour that comes twice in October could be either. The
 * candidates are the clock's time taken as UTC shifted by up to three hours either way, as
 * `eingabeInBerlin` does, asked of the fast clock of uhr.ts (20,000 lines within 1 s).
 */
export const berlinerZeitpunkt = (
  uhr: BerlinerUhr,
  tag: string,
  sekunden: number,
): number | null => {
  const minute = Math.floor(sekunden / 60);
  const alsUtc = Date.parse(`${tag}T00:00:00Z`) + minute * MINUTE;
  const treffer = [-3, -2, -1, 0, 1, 2, 3]
    .map((stunden) => alsUtc + stunden * STUNDE)
    .filter((kandidat) => {
      const wand = uhr.uhr(kandidat);
      return wand.tag === tag && wand.minute === minute;
    });
  if (treffer.length !== 1) return null;
  return (treffer[0] as number) + (sekunden % 60) * SEKUNDE;
};

/** An instant as the APIs write it, ISO 8601 with `Z` or an offset, or null */
export const zeitpunktLesen = (wert: unknown): number | null => {
  if (typeof wert !== "string") return null;
  const teile =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})$/.exec(wert);
  if (!teile || !istTag(teile[1] as string)) return null;
  const [stunde, minute, sekunde] = [teile[2], teile[3], teile[4]].map(Number) as number[];
  if ((stunde as number) > 23 || (minute as number) > 59 || (sekunde as number) > 59) return null;
  const versatz = teile[5] as string;
  const minuten =
    versatz === "Z"
      ? 0
      : (versatz.startsWith("-") ? -1 : 1) *
        (Number(versatz.slice(1, 3)) * 60 + Number(versatz.slice(-2)));
  if (Math.abs(minuten) > 18 * 60) return null;
  const utc = Date.parse(`${teile[1]}T${teile[2]}:${teile[3]}:${teile[4]}Z`);
  return Number.isNaN(utc) ? null : utc - minuten * MINUTE;
};

/** An instant as the file of a fetch writes it: UTC, whole seconds */
export const zeitpunktText = (ms: number): string =>
  new Date(Math.floor(ms / SEKUNDE) * SEKUNDE).toISOString().replace(".000Z", "Z");
