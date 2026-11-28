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

export const VIERTEL_MINUTEN = [0, 15, 30, 45] as const;

export const stundeDrehen = (stunde: number, schritt: -1 | 1): number =>
  (stunde + schritt + 24) % 24;
export const minuteDrehen = (minute: number, schritt: -1 | 1): number =>
  (minute + schritt + 60) % 60;

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

/** Returns empty string if value is empty or a valid YYYY-MM-DD within [min, max], else an error key */
export const datumGueltig = (wert: string, min?: string, max?: string): string => {
  if (wert === "") return "";
  if (!ISO_DATUM.test(wert)) return "format";
  const [j, m, t] = wert.split("-").map(Number);
  const d = new Date(Date.UTC(j ?? 0, (m ?? 1) - 1, t ?? 1, 12));
  if (d.toISOString().slice(0, 10) !== wert) return "format";
  if (min && ISO_DATUM.test(min) && wert < min) return "min";
  if (max && ISO_DATUM.test(max) && wert > max) return "max";
  return "";
};

/** Returns 7 distinct localized Mon-Sun weekday headers (narrow for Arabic, short otherwise) */
export const wochentagKuerzel = (sprache: string): string[] => {
  const fmt = new Intl.DateTimeFormat(sprache, {
    weekday: sprache.toLowerCase().startsWith("ar") ? "narrow" : "short",
    timeZone: "UTC",
  });
  // 2026-11-23 is a Monday
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(Date.UTC(2026, 10, 23 + i, 12))).replace(/\.$/, ""),
  );
};

/** Formats an ISO YYYY-MM-DD date in the active locale (e.g. 27.11.2026 in de, 11/27/2026 in en) */
export const datumAnzeigen = (wert: string, sprache: string): string => {
  if (!ISO_DATUM.test(wert)) return wert;
  const [j, m, t] = wert.split("-").map(Number);
  return new Intl.DateTimeFormat(sprache, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(j ?? 0, (m ?? 1) - 1, t ?? 1, 12)));
};

export type ZeitFeld = "day" | "month" | "year" | "hour" | "minute";

/** Localized field name from the browser's Intl.DisplayNames ("Monat", "Jahr", "Stunde", ...) */
export const einheitName = (feld: ZeitFeld, sprache: string): string => {
  try {
    return new Intl.DisplayNames([sprache], { type: "dateTimeField" }).of(feld) ?? feld;
  } catch {
    return feld;
  }
};

/** Full localized accessible date name (e.g. "Freitag, 27. November 2026") */
export const datumLang = (wert: string, sprache: string): string => {
  if (!ISO_DATUM.test(wert)) return wert;
  const [j, m, t] = wert.split("-").map(Number);
  return new Intl.DateTimeFormat(sprache, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(j ?? 0, (m ?? 1) - 1, t ?? 1, 12)));
};

/** Next cell index in the 42-cell (6 × 7) calendar grid for arrow/Home/End keys, RTL-aware */
export const kalenderNachbar = (index: number, taste: string, rtl: boolean): number | undefined => {
  const schritt = rtl ? -1 : 1;
  let ziel: number | undefined;
  if (taste === "ArrowRight") ziel = index + schritt;
  else if (taste === "ArrowLeft") ziel = index - schritt;
  else if (taste === "ArrowDown") ziel = index + 7;
  else if (taste === "ArrowUp") ziel = index - 7;
  else if (taste === "Home") ziel = index - (index % 7);
  else if (taste === "End") ziel = index + (6 - (index % 7));
  if (ziel === undefined || ziel < 0 || ziel >= 42) return undefined;
  return ziel;
};
