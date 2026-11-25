export { kennungVon, kurzerText } from "../abzug-gemeinsam.ts";

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
