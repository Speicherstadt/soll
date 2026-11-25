import { m } from "../paraglide/messages.js";
import type { Stand } from "./typen.ts";

const FEHLER: Record<string, () => string> = {
  haben_fehlt: m.haben_fehler_fehlt,
  schluessel_falsch: m.haben_fehler_schluessel,
  token_fehlt: m.haben_fehler_token,
  kunde_ohne_haben: m.haben_fehler_kunde,
  zu_lang: m.haben_fehler_zu_lang,
  kontakt_unbekannt: m.haben_fehler_kontakt,
  abgerechnet: m.haben_fehler_abgerechnet,
  doppelt: m.haben_fehler_doppelt,
  nicht_erreichbar: m.haben_fehler_erreichbar,
  zugang_abgelehnt: m.haben_fehler_zugang,
  recht_fehlt: m.haben_fehler_recht,
  abgelehnt: m.haben_fehler_abgelehnt,
  zu_viele: m.haben_fehler_zu_viele,
  haben_fehler: m.haben_fehler_haben,
  netz: m.fehler_netz,
};

/** The text of a refusal of Soll or a failure of Haben */
export const habenFehler = (fehler: string): string => (FEHLER[fehler] ?? m.fehler_speichern)();

const STAND: Record<Stand, () => string> = {
  offen: m.haben_stand_offen,
  abgerechnet: m.haben_stand_abgerechnet,
  wartet: m.haben_stand_wartet,
  gesendet: m.haben_stand_gesendet,
};

/** A booking's state towards Haben in words */
export const standText = (stand: Stand): string => STAND[stand]();
