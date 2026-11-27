/** Pure calendar and time helpers for DatePicker and TimePicker (no framework imports) */

export const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_ZEIT = /^([01]\d|2[0-3]):[0-5]\d$/;

export type KalenderZelle = {
  tag: string;
  nummer: number;
  imMonat: boolean;
  deaktiviert: boolean;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Today's YYYY-MM-DD in the browser's local timezone */
export const heuteIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Shifts a YYYY-MM month by delta (-1 or +1) */
export const monatVerschieben = (jahr: number, monat: number, schritt: -1 | 1) => {
  const d = new Date(Date.UTC(jahr, monat + schritt, 1, 12));
  return { jahr: d.getUTCFullYear(), monat: d.getUTCMonth() };
};

/** Builds a 42-cell (6-week, Mon-Sun) calendar grid for a given year & 0-indexed month */
export const kalenderGitter = (
  jahr: number,
  monat: number,
  min?: string,
  max?: string,
): KalenderZelle[] => {
  const erster = new Date(Date.UTC(jahr, monat, 1, 12));
  const startOffset = (erster.getUTCDay() || 7) - 1;
  const startMs = erster.getTime() - startOffset * 86_400_000;
  const zielMonat = `${jahr}-${pad2(monat + 1)}`;

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startMs + i * 86_400_000);
    const tag = d.toISOString().slice(0, 10);
    const deaktiviert =
      (min !== undefined && ISO_DATUM.test(min) && tag < min) ||
      (max !== undefined && ISO_DATUM.test(max) && tag > max);
    return {
      tag,
      nummer: d.getUTCDate(),
      imMonat: tag.startsWith(zielMonat),
      deaktiviert,
    };
  });
};

/** Parses a HH:MM string into hour (0..23) and minute (0..59), or null */
export const zeitTeilen = (wert: string): { stunde: number; minute: number } | null => {
  if (!ISO_ZEIT.test(wert)) return null;
  const [h, m] = wert.split(":");
  return { stunde: Number(h), minute: Number(m) };
};

export const zeitFormatieren = (stunde: number, minute: number): string =>
  `${pad2(Math.max(0, Math.min(23, stunde)))}:${pad2(Math.max(0, Math.min(59, minute)))}`;

export const STUNDEN = Array.from({ length: 24 }, (_, i) => i);
export const MINUTEN = Array.from({ length: 12 }, (_, i) => i * 5);

export type PopoverRect = { top: number; bottom: number; left: number; right: number };

/** Computes fixed viewport coordinates so a popover never clips off-screen or inside a <dialog> */
export const popoverPosition = (
  anker: PopoverRect,
  breite: number,
  hoehe: number,
  viewW: number,
  viewH: number,
  abstand = 6,
): { top: number; left: number } => {
  const platzUnten = viewH - anker.bottom - abstand;
  const obenAuf = platzUnten < hoehe && anker.top - abstand >= hoehe;
  const top = obenAuf
    ? Math.max(8, anker.top - hoehe - abstand)
    : Math.max(8, Math.min(anker.bottom + abstand, viewH - hoehe - 8));
  const left = Math.max(8, Math.min(anker.left, viewW - breite - 8));
  return { top, left };
};
