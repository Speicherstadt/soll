import type { Antwort } from "../api.ts";

/** What the kiosk tells the person in front of it after a refusal or a failure */
export type Meldung =
  | { art: "unbekannt"; rest: number }
  | { art: "gesperrt"; bis: number }
  | { art: "netz" }
  /** a card's tap went unanswered: the next tap brings a new SUN message (S-803) */
  | { art: "nochmal" }
  /** a stamp after a SUN message went unanswered: whether it is on the server is unknown (S-803) */
  | { art: "unklar" }
  | { art: "modul_aus" }
  | { art: "abgeschlossen" }
  | { art: "fehler" };

/** The device token is unknown or revoked: the tablet must be paired again */
export const entkoppelt = (antwort: Antwort<unknown>): boolean =>
  !antwort.ok && antwort.status === 401 && antwort.fehler === "terminal_unbekannt";

const zahl = (koerper: unknown, feld: string): number | null => {
  const wert = (koerper as Record<string, unknown> | null)?.[feld];
  return typeof wert === "number" ? wert : null;
};

/** A refusal of the kiosk's API as a message (pure, so the kiosk only shows it) */
export const meldungAus = (antwort: Antwort<unknown>): Meldung | null => {
  if (antwort.ok) return null;
  if (antwort.status === 0) return { art: "netz" };
  if (antwort.fehler === "gesperrt")
    return { art: "gesperrt", bis: zahl(antwort.koerper, "gesperrtBis") ?? 0 };
  if (antwort.fehler === "unbekannt")
    return { art: "unbekannt", rest: zahl(antwort.koerper, "rest") ?? 0 };
  if (antwort.fehler === "modul_aus") return { art: "modul_aus" };
  if (antwort.fehler === "abgeschlossen") return { art: "abgeschlossen" };
  return { art: "fehler" };
};
