import type { LeseFehler } from "./modell.ts";
import { MAX_TEXT } from "./modell.ts";
import { bereinigt } from "./text.ts";

/*
 * What the readers of a fetch over an API share (Clockodo S-703, Kimai S-705): a file of JSON Lines
 * with one flat record per line, ids as whole numbers, short texts, each id once per kind, and the
 * names of the users as the persons of the mapping.
 */

type Satz = Record<string, unknown>;

/**
 * Whether a line is one flat object: a `{` at its start and no other bracket outside a string. The
 * files hold only flat records; a line of millions of nested brackets would keep JSON.parse busy
 * for half a second, so it is refused before (no file hangs a reader).
 */
const flach = (zeile: string): boolean => {
  const text = zeile.trim();
  if (!text.startsWith("{")) return false;
  let inText = false;
  for (let i = 1; i < text.length; i++) {
    const zeichen = text[i];
    if (inText) {
      if (zeichen === "\\") i++;
      else if (zeichen === '"') inText = false;
    } else if (zeichen === '"') inText = true;
    else if (zeichen === "{" || zeichen === "[") return false;
  }
  return true;
};

/** A line as one flat JSON object, or null */
export const objekt = (zeile: string): Satz | null => {
  if (!flach(zeile)) return null;
  try {
    const wert: unknown = JSON.parse(zeile);
    return typeof wert === "object" && wert !== null && !Array.isArray(wert)
      ? (wert as Satz)
      : null;
  } catch {
    return null;
  }
};

/** A text of at most MAX_TEXT characters, its spaces folded, or null */
export const kurzerText = (wert: unknown): string | null =>
  typeof wert === "string" && wert.length <= MAX_TEXT ? bereinigt(wert) : null;

/** An id as the tools give it, a whole number, as text; or null */
export const kennungVon = (wert: unknown): string | null => {
  if (typeof wert === "number" && Number.isSafeInteger(wert)) return String(wert);
  if (typeof wert === "string" && /^\d{1,18}$/.test(wert.trim())) return wert.trim();
  return null;
};

/** The first record of each id; a later one of the same kind is refused with its line */
export const einmal = <T extends { zeile: number; id: string }>(
  saetze: readonly T[],
  fehler: LeseFehler[],
): T[] => {
  const gesehen = new Set<string>();
  return saetze.filter((satz) => {
    if (!gesehen.has(satz.id)) return gesehen.add(satz.id);
    fehler.push({ zeile: satz.zeile, grund: "kennung_doppelt", feld: "id", wert: satz.id });
    return false;
  });
};

/**
 * A user's name as the person of the mapping; two users of the same name keep their id, so the
 * owner can tell them apart. A user the data does not list is named by its id.
 */
export const personen = (nutzer: readonly { id: string; name: string }[]) => {
  const zahl = new Map<string, number>();
  for (const n of nutzer) zahl.set(n.name, (zahl.get(n.name) ?? 0) + 1);
  const namen = new Map(
    nutzer.map((n) => [n.id, (zahl.get(n.name) ?? 0) > 1 ? `${n.name} (${n.id})` : n.name]),
  );
  return (id: string): string => namen.get(id) ?? `#${id}`;
};
