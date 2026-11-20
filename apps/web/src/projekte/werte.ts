import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Taetigkeit } from "./typen.ts";

/**
 * Minutes of a budget written as whole hours ("40") or hours and minutes ("12:30"); null for an
 * entry that is none. Whole numbers only (CLAUDE.md, "Never").
 */
export const budgetMinutenAus = (text: string): number | null => {
  const teile = /^(\d{1,6})(?::([0-5]\d))?$/.exec(text.trim());
  if (!teile) return null;
  const minuten = Number(teile[1]) * 60 + Number(teile[2] ?? "0");
  return minuten > 0 ? minuten : null;
};

const FESTE_NAMEN: Record<string, () => string> = {
  fahrt: m.taetigkeit_fahrt,
  werkstatt: m.taetigkeit_werkstatt,
  lager: m.taetigkeit_lager,
  schulung: m.taetigkeit_schulung,
};

/** The fixed activities have no name of their own: the app names them in each language */
export const taetigkeitName = (taetigkeit: Pick<Taetigkeit, "taetigkeitId" | "name" | "fest">) =>
  taetigkeit.fest ? (FESTE_NAMEN[taetigkeit.taetigkeitId]?.() ?? "") : taetigkeit.name;

const FEHLER: Record<string, () => string> = {
  verwendet: m.fehler_verwendet,
  doppelt: m.fehler_doppelt,
  archiviert: m.fehler_archiviert,
  netz: m.fehler_netz,
};

/** The text of a refusal of the server */
export const fehlerText = (fehler: string): string => (FEHLER[fehler] ?? m.fehler_speichern)();

/** A calendar day with its year, read at noon in UTC so no time zone moves it */
export const datumText = (tag: string): string =>
  new Intl.DateTimeFormat(getLocale(), { timeZone: "UTC", dateStyle: "medium" }).format(
    Date.parse(`${tag}T12:00:00Z`),
  );
