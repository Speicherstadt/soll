import type { SichtbareArt, Tag } from "@soll/arbeitszeit";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Abwesenheit } from "./typen.ts";

/** The words for absences in the language of the app; norms stay German (DESIGN.md, "Texte") */
export const ART: Record<SichtbareArt, () => string> = {
  urlaub: () => m.abw_art_urlaub(),
  krank: () => m.abw_art_krank(),
  kind_krank: () => m.abw_art_kind_krank(),
  sonderurlaub: () => m.abw_art_sonderurlaub(),
  ueberstundenabbau: () => m.abw_art_ueberstundenabbau(),
  abwesend: () => m.abw_art_abwesend(),
};

export const STATUS: Record<Abwesenheit["status"], () => string> = {
  beantragt: () => m.abw_status_beantragt(),
  genehmigt: () => m.abw_status_genehmigt(),
  abgelehnt: () => m.abw_status_abgelehnt(),
  zurueckgezogen: () => m.abw_status_zurueckgezogen(),
  storniert: () => m.abw_status_storniert(),
};

export const FEHLER: Record<string, () => string> = {
  ueberschneidung: () => m.abw_fehler_ueberschneidung(),
  abgeschlossen: () => m.abw_fehler_abgeschlossen(),
  ungueltig: () => m.abw_fehler_ungueltig(),
  status: () => m.abw_fehler_status(),
};

export const fehlerText = (code: string): string =>
  (FEHLER[code] ?? (() => m.fehler_speichern()))();

/** "21.12." or "21.12.2026" in the language of the app, digits Latin */
export const tagText = (tag: Tag, mitJahr = false): string =>
  new Intl.DateTimeFormat(getLocale(), {
    timeZone: "UTC",
    day: "numeric",
    month: "numeric",
    ...(mitJahr ? { year: "numeric" } : {}),
    numberingSystem: "latn",
  }).format(Date.parse(`${tag}T12:00:00Z`));

/** The span of an absence: one day, from–to, or from with an open end */
export const zeitraumText = (a: { von: Tag; bis: Tag | null }): string =>
  a.bis === null
    ? m.abw_ab({ von: tagText(a.von) })
    : a.bis === a.von
      ? tagText(a.von)
      : m.abw_zeitraum({ von: tagText(a.von), bis: tagText(a.bis) });

/** Half days in words: "1 Tag", "2,5 Tage" (CLAUDE.md: leave in half days) */
export const tageText = (halbtage: number): string => {
  const anzahl = new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: 1,
    numberingSystem: "latn",
  }).format(halbtage / 2);
  return halbtage === 2 ? m.abw_tag_eins() : m.abw_tage({ anzahl });
};
