import type { BerlinerUhr } from "../uhr.ts";

/*
 * The values of Personio's API v2, read without a guess: what is not one of them is null (S-704).
 */

const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;
const TAG = 24 * STUNDE;

/**
 * An id as Personio gives it: a person's number ("3003", persons-service-api-v2) or the UUID of a
 * period or an absence type; as text, or null
 */
export const personioKennung = (wert: unknown): string | null => {
  if (typeof wert === "number" && Number.isSafeInteger(wert) && wert >= 0) return String(wert);
  if (typeof wert === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(wert)) return wert;
  return null;
};

/** A local date-time: the wall clock in milliseconds as if it were UTC, and whether seconds follow */
export type Ortszeit = { lokal: number; rest: boolean };

/**
 * A date-time as Personio writes the periods: local time of the company without an offset,
 * "2026-09-01T07:00:00", sometimes with milliseconds ("…T00:00:00.000"; n8n-nodes-personio-hr:
 * "Local time, no timezone offset"). A day that does not exist, a year outside 2000 to 2099 or an
 * offset is null: Soll does not guess which zone was meant.
 */
export const ortszeitLesen = (wert: unknown): Ortszeit | null => {
  if (typeof wert !== "string") return null;
  const teile = /^(20\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,6}))?$/.exec(wert);
  if (!teile) return null;
  const [jahr, monat, tag, stunde, minute, sekunde] = teile.slice(1, 7).map(Number) as number[];
  if ((stunde as number) > 23 || (minute as number) > 59 || (sekunde as number) > 59) return null;
  const mitternacht = Date.UTC(jahr as number, (monat as number) - 1, tag);
  const datum = new Date(mitternacht);
  if (datum.getUTCMonth() !== (monat as number) - 1 || datum.getUTCDate() !== tag) return null;
  const bruch = Number(teile[7] ?? "0");
  return {
    lokal: mitternacht + ((stunde as number) * 60 + (minute as number)) * MINUTE,
    rest: (sekunde as number) > 0 || bruch > 0,
  };
};

/** The day of a local date-time */
export const tagVon = (ort: Ortszeit): string => new Date(ort.lokal).toISOString().slice(0, 10);

/** Whether a local date-time names a whole day: midnight, or the day's last second (23:59:59) */
export const ganzerTag = (ort: Ortszeit): boolean => {
  const minute = (ort.lokal % TAG) / MINUTE;
  return (minute === 0 && !ort.rest) || (minute === 24 * 60 - 1 && ort.rest);
};

/** A local date-time on a whole minute: down (`ab`) or, when seconds follow, up (`auf`) */
export const aufMinute = (ort: Ortszeit, richtung: "ab" | "auf"): number =>
  richtung === "auf" && ort.rest ? ort.lokal + MINUTE : ort.lokal;

/**
 * The instant a Berlin wall clock shows at `lokal` (a whole minute): "fehlt" for a time the clocks
 * skip in March, "doppelt" for one of the hour that comes twice in October, which a local time
 * without an offset cannot tell apart. Berlin kept +1 or +2 hours in every year read (2000–2099).
 */
export const zeitpunktIn = (uhr: BerlinerUhr, lokal: number): number | "fehlt" | "doppelt" => {
  const tag = new Date(lokal).toISOString().slice(0, 10);
  const minute = (lokal - Date.parse(`${tag}T00:00:00Z`)) / MINUTE;
  const treffer = [lokal - STUNDE, lokal - 2 * STUNDE].filter((kandidat) => {
    const zeit = uhr.uhr(kandidat);
    return zeit.tag === tag && zeit.minute === minute;
  });
  if (treffer.length === 0) return "fehlt";
  return treffer.length > 1 ? "doppelt" : (treffer[0] as number);
};
