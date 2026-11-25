/*
 * How the time sheet writes days, times and durations: German, as the sheet is a record under German
 * law (docs/plan.md, "Sprache des Stundenzettels"); durations as 7:30, never as decimals (DESIGN.md).
 */

const MONATE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** "2026-10" → "Oktober 2026" */
export const monatText = (monat: string): string =>
  `${MONATE[Number(monat.slice(5, 7)) - 1] ?? monat} ${monat.slice(0, 4)}`;

/** "2026-10-01" → "Do 01.10." */
export const tagText = (tag: string): string => {
  const wochentag = new Date(`${tag}T12:00:00Z`).getUTCDay();
  return `${WOCHENTAGE[wochentag]} ${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;
};

/** "2026-10-01" → "01.10.2026" */
export const datumText = (tag: string): string =>
  `${tag.slice(8, 10)}.${tag.slice(5, 7)}.${tag.slice(0, 4)}`;

const uhr = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const tagInBerlin = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** An instant as Berlin wall time, "08:00" */
export const uhrzeitText = (zeitpunkt: number): string => uhr.format(zeitpunkt);

/** An instant as Berlin date and time, "02.11.2026 09:15" */
export const zeitpunktText = (zeitpunkt: number): string =>
  `${datumText(tagInBerlin.format(zeitpunkt))} ${uhrzeitText(zeitpunkt)}`;

/** Half days of leave (never negative) as days, German: 17 → "8,5 Tage", 2 → "1 Tag" */
export const halbtageText = (halbtage: number): string =>
  `${Math.floor(halbtage / 2)}${halbtage % 2 === 1 ? ",5" : ""} ${halbtage === 2 ? "Tag" : "Tage"}`;

/** Whole minutes as "7:30", with a sign when asked: "+3:28", "-0:15" */
export const dauerText = (minuten: number, vorzeichen = false): string => {
  const betrag = Math.abs(minuten);
  const text = `${Math.floor(betrag / 60)}:${String(betrag % 60).padStart(2, "0")}`;
  if (minuten < 0) return `-${text}`;
  return vorzeichen ? `+${text}` : text;
};
