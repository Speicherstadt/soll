import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Taetigkeit } from "./typen.ts";

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
