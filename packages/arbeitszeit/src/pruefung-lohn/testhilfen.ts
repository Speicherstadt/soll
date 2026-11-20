import { um } from "../arbeitstag/testhilfen.ts";
import type { Monat } from "../kalender/monat.ts";
import { plusTage, type Tag } from "../kalender/tag.ts";
import { tagMit } from "../pruefung/testhilfen.ts";
import type { PruefTag } from "../pruefung/typen.ts";
import type { ErfassteStempelung } from "./aufzeichnung.ts";
import type { Lohn, Lohnmonat, Zuschlag } from "./lohn.ts";

/*
 * Helpers for the tests of § 17 MiLoG, § 1 MiLoG and § 8 SGB IV. Wall-clock times carry their UTC
 * offset, as in the tests of the working day.
 */
export { um } from "../arbeitstag/testhilfen.ts";
export { tagMit } from "../pruefung/testhilfen.ts";

/** A stamp at a wall-clock time, recorded at another */
export const erfasst = (
  art: ErfassteStempelung["art"],
  zeitpunkt: string,
  wann: string,
  ersetzt?: string,
): ErfassteStempelung => ({
  art,
  zeitpunkt: um(zeitpunkt),
  erfasst: um(wann),
  ...(ersetzt === undefined ? {} : { ersetzt: um(ersetzt) }),
});

/** `minuten` of work spread over days from `ab` on, at most 516 (8:36) a day */
export const arbeitIm = (ab: Tag, minuten: number): PruefTag[] => {
  const tage: PruefTag[] = [];
  for (let rest = minuten, tag = ab; rest > 0; tag = plusTage(tag, 1)) {
    const heute = Math.min(rest, 516);
    tage.push(tagMit(tag, heute));
    rest -= heute;
  }
  return tage;
};

export const monat = (
  monatText: Monat,
  lohn: Lohn,
  tage: PruefTag[] = [],
  weiteres: { minijob?: boolean; zuschlaege?: Zuschlag[] } = {},
): Lohnmonat => ({ monat: monatText, lohn, minijob: weiteres.minijob ?? true, tage, ...weiteres });

export const gehalt = (cent: number): Lohn => ({ art: "monat", cent });
export const stundenlohn = (cent: number): Lohn => ({ art: "stunde", cent });
