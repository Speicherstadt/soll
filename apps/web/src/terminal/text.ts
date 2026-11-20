import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import { sekundenBis } from "./eingabe.ts";
import type { Meldung } from "./meldung.ts";

/** The big clock: Berlin time, Latin digits in every language (DESIGN.md, "Texte") */
export const uhrText = (ms: number): string =>
  new Intl.DateTimeFormat(getLocale(), {
    timeZone: "Europe/Berlin",
    numberingSystem: "latn",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(ms);

export const datumText = (ms: number): string =>
  new Intl.DateTimeFormat(getLocale(), {
    timeZone: "Europe/Berlin",
    numberingSystem: "latn",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(ms);

export const meldungText = (meldung: Meldung, jetzt: number): string => {
  switch (meldung.art) {
    case "unbekannt":
      return m.kiosk_unbekannt({ rest: meldung.rest });
    case "gesperrt":
      return m.kiosk_gesperrt({ sekunden: sekundenBis(meldung.bis, jetzt) });
    case "netz":
      return m.kiosk_ohne_netz();
    case "modul_aus":
      return m.kiosk_modul_aus();
    case "abgeschlossen":
      return m.kiosk_abgeschlossen();
    default:
      return m.kiosk_fehler();
  }
};
