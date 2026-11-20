import { HAMBURG } from "../pruefung-nacht-sonntag/testhilfen.ts";
import type { MutterschutzOptionen } from "./typen.ts";

export { gehen, kommen, pause, schicht, tage, um, weiter } from "../pruefung/testhilfen.ts";
export { h, MONTAG, mez, woche } from "../pruefung-jugend/testhilfen.ts";
/*
 * Helpers for the tests of the MuSchG. Lea works shifts in the Café Elbblick (Hamburg; CLAUDE.md,
 * test data); the mark on her record holds a span through all of 2026 and 2027.
 */
export { HAMBURG, tagAb } from "../pruefung-nacht-sonntag/testhilfen.ts";

export const SPAETER = Date.parse("2030-01-01T00:00Z");

export const LEA: MutterschutzOptionen = {
  zeitraeume: [{ von: "2026-01-01", bis: "2027-12-31" }],
  geburtsdatum: "1997-04-12",
  standort: HAMBURG,
  jetzt: SPAETER,
};
