import type { Land, Modul, Region } from "@soll/arbeitszeit";
import type { CsvRolle } from "@soll/import";
import { m } from "../paraglide/messages.js";
import type { Hinweis } from "./schritte.ts";
import type { Vorlage } from "./vorlagen.ts";

/** The names a person reads for the codes of the API, in the language of the app */

export const LAND_NAMEN: Record<Land, () => string> = {
  BW: m.land_bw,
  BY: m.land_by,
  BE: m.land_be,
  BB: m.land_bb,
  HB: m.land_hb,
  HH: m.land_hh,
  HE: m.land_he,
  MV: m.land_mv,
  NI: m.land_ni,
  NW: m.land_nw,
  RP: m.land_rp,
  SL: m.land_sl,
  SN: m.land_sn,
  ST: m.land_st,
  SH: m.land_sh,
  TH: m.land_th,
};

export const REGION_NAMEN: Record<Region, () => string> = {
  augsburg: m.region_augsburg,
  katholisch: m.region_katholisch,
  fronleichnam_sachsen: m.region_fronleichnam_sachsen,
  fronleichnam_thueringen: m.region_fronleichnam_thueringen,
};

export const ROLLEN_NAMEN: Record<CsvRolle | "geraet", () => string> = {
  inhaber: m.rolle_inhaber,
  planer: m.rolle_planer,
  mitarbeiter: m.rolle_mitarbeiter,
  lohnbuero: m.rolle_lohnbuero,
  betriebsrat: m.rolle_betriebsrat,
  extern: m.rolle_extern,
  geraet: m.rolle_geraet,
};

export const MODUL_NAMEN: Record<Modul, () => string> = {
  arbeitszeit: m.modul_arbeitszeit,
  dienstplan: m.modul_dienstplan,
  projektzeit: m.modul_projektzeit,
  terminal: m.modul_terminal,
};

export const VORLAGE_NAMEN: Record<Vorlage["id"], () => string> = {
  vollzeit: m.vorlage_vollzeit,
  teilzeit: m.vorlage_teilzeit,
  minijob: m.vorlage_minijob,
};

export const HINWEIS_TEXTE: Record<Hinweis, () => string> = {
  pflicht: m.hinweis_pflicht,
  solo: m.hinweis_solo,
  feiertage: m.hinweis_feiertage,
  terminal_standort: m.hinweis_terminal_standort,
  vorlagen: m.hinweis_vorlagen,
  dienstplan_soll: m.hinweis_dienstplan_soll,
  csv_vorlage: m.hinweis_csv_vorlage,
  links_einmal: m.hinweis_links_einmal,
  terminal_pin: m.hinweis_terminal_pin,
  danach_stempeln: m.hinweis_danach_stempeln,
  danach_dienstplan: m.hinweis_danach_dienstplan,
  danach_projekte: m.hinweis_danach_projekte,
  danach_terminal: m.hinweis_danach_terminal,
};
