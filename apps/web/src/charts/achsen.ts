import { dauerText } from "../einrichtung/werte.ts";
import { saldoText } from "../monat/zeilen.ts";

/** Format a non-negative chart Y-axis hour value as H:MM (DESIGN.md: never decimal hours) */
export const stundenAchseText = (stunden: number): string =>
  dauerText(Math.max(0, Math.round(stunden * 60)));

/** Format a signed balance chart Y-axis hour value as +H:MM / -H:MM (0:00 at zero) */
export const saldoAchseText = (stunden: number): string => {
  const minuten = Math.round(stunden * 60);
  if (minuten === 0) return "0:00";
  return saldoText(minuten);
};
