import type { LeseFehler, LeseGrund } from "@soll/import";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Art } from "./typen.ts";
import type { Schritt } from "./zustand.ts";

/* The words of the move page in the language of the app (S-701) */

export const SCHRITT_NAMEN: Record<Schritt, () => string> = {
  werkzeug: () => m.umzug_schritt_werkzeug(),
  datei: () => m.umzug_schritt_datei(),
  zuordnung: () => m.umzug_schritt_zuordnung(),
  vorschau: () => m.umzug_schritt_vorschau(),
  uebernahme: () => m.umzug_schritt_uebernahme(),
};

/** How to export the data of each tool, by its id in packages/import */
export const ANLEITUNG: Record<string, () => string> = {
  "soll-csv": () => m.umzug_anleitung_soll_csv(),
};

const LESEGRUND: Record<LeseGrund, () => string> = {
  kein_kopf: () => m.umzug_lese_kein_kopf(),
  zu_viele: () => m.umzug_lese_zu_viele(),
  unlesbar: () => m.umzug_lese_unlesbar(),
  typ_unbekannt: () => m.umzug_lese_typ_unbekannt(),
  kennung_fehlt: () => m.umzug_lese_kennung_fehlt(),
  kennung_doppelt: () => m.umzug_lese_kennung_doppelt(),
  person_fehlt: () => m.umzug_lese_person_fehlt(),
  name_fehlt: () => m.umzug_lese_name_fehlt(),
  zu_lang: () => m.umzug_lese_zu_lang(),
  datum_ungueltig: () => m.umzug_lese_datum_ungueltig(),
  zeit_ungueltig: () => m.umzug_lese_zeit_ungueltig(),
  pause_ungueltig: () => m.umzug_lese_pause_ungueltig(),
  art_fehlt: () => m.umzug_lese_art_fehlt(),
  kunde_unbekannt: () => m.umzug_lese_kunde_unbekannt(),
};

/** A line the reader refused, with the value it held */
export const lesefehlerText = (fehler: LeseFehler): string => {
  const grund = LESEGRUND[fehler.grund]();
  const mitWert = fehler.wert ? `${grund} (${fehler.wert})` : grund;
  return m.umzug_zeile({ zeile: fehler.zeile, grund: mitWert });
};

const PLANGRUND: Record<string, () => string> = {
  person_unbekannt: () => m.umzug_grund_person_unbekannt(),
  modul_aus: () => m.umzug_grund_modul_aus(),
  zeit_gibt_es_nicht: () => m.umzug_grund_zeit_gibt_es_nicht(),
  pause_ungueltig: () => m.umzug_grund_pause_ungueltig(),
  zukunft: () => m.umzug_grund_zukunft(),
  ueberschneidung: () => m.umzug_grund_ueberschneidung(),
  monat_abgeschlossen: () => m.umzug_grund_monat_abgeschlossen(),
  kunde_unbekannt: () => m.umzug_grund_kunde_unbekannt(),
  projekt_unbekannt: () => m.umzug_grund_projekt_unbekannt(),
  kunde_ausgelassen: () => m.umzug_grund_kunde_ausgelassen(),
  zuordnung_abweichend: () => m.umzug_grund_zuordnung_abweichend(),
  geaendert_im_alten_tool: () => m.umzug_grund_geaendert_im_alten_tool(),
};

export const abgelehntText = (zeile: number, grund: string): string =>
  m.umzug_zeile({ zeile, grund: PLANGRUND[grund]?.() ?? grund });

export const ART_NAMEN: Record<Art, () => string> = {
  zeiten: () => m.umzug_art_zeiten(),
  abwesenheiten: () => m.umzug_art_abwesenheiten(),
  kunden: () => m.umzug_art_kunden(),
  projekte: () => m.umzug_art_projekte(),
};

export const FELD_NAMEN: Record<string, () => string> = {
  typ: () => m.umzug_feld_typ(),
  kennung: () => m.umzug_feld_kennung(),
  person: () => m.umzug_feld_person(),
  datum: () => m.umzug_feld_datum(),
  beginn: () => m.umzug_feld_beginn(),
  ende: () => m.umzug_feld_ende(),
  pause: () => m.umzug_feld_pause(),
  bis: () => m.umzug_feld_bis(),
  art: () => m.umzug_feld_art(),
  kunde: () => m.umzug_feld_kunde(),
  name: () => m.umzug_feld_name(),
  nummer: () => m.umzug_feld_nummer(),
};

/** A calendar day, read at noon so no time zone moves it */
export const tagKurz = (tag: string): string =>
  new Intl.DateTimeFormat(getLocale(), { timeZone: "UTC", dateStyle: "medium" }).format(
    Date.parse(`${tag}T12:00:00Z`),
  );

/** When an import was taken over, on a clock in Berlin */
export const zeitpunktKurz = (ms: number): string =>
  new Intl.DateTimeFormat(getLocale(), {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(ms);
