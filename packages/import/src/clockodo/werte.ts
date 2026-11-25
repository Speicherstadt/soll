import { MAX_TEXT } from "../modell.ts";
import { bereinigt } from "../text.ts";

/* The values of Clockodo's data, read without a guess: what is not one of them is null (S-703) */

/**
 * An instant in ISO 8601 as Clockodo writes it in UTC ("2021-10-19T12:58:36Z", with the header
 * X-ClockodoEnableIsoUtcDateTimes in the API and in the CSV backup; SDK src/lib/api.ts and
 * src/models/entry.csv.test.ts), from 2000 to 2099: older and later ones are no working time
 */
export const zeitpunktLesen = (text: string): number | null => {
  const teile = /^(20\d\d)-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.exec(
    text.trim(),
  );
  if (!teile) return null;
  const ms = Date.parse(text.trim());
  return Number.isNaN(ms) ? null : ms;
};

/** Whole seconds of a correction; empty is none */
export const sekundenLesen = (text: string): number | null => {
  const wert = text.trim();
  if (wert === "") return 0;
  return /^-?\d{1,9}$/.test(wert) ? Number(wert) : null;
};

/** A text of at most MAX_TEXT characters, its spaces folded, or null */
export const kurzerText = (wert: unknown): string | null =>
  typeof wert === "string" && wert.length <= MAX_TEXT ? bereinigt(wert) : null;

/** An id as Clockodo gives it, a whole number, as text; or null */
export const kennungVon = (wert: unknown): string | null => {
  if (typeof wert === "number" && Number.isSafeInteger(wert)) return String(wert);
  if (typeof wert === "string" && /^\d{1,18}$/.test(wert.trim())) return wert.trim();
  return null;
};
