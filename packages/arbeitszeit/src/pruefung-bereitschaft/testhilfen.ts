import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import { tage, um } from "../pruefung/testhilfen.ts";
import { type BereitschaftOptionen, bereitschaftBefunde } from "./bereitschaft.ts";
import { bereitschaftstage } from "./bereitschaftstage.ts";
import type { BereitschaftEingabe, BereitschaftsTag, Spanne } from "./typen.ts";

export { gehen, kommen } from "../arbeitstag/testhilfen.ts";
/*
 * Helpers for the tests of R-11 and R-12. Wall-clock times carry their UTC offset, as in the tests
 * of S-201 and S-202, so every DST case states which side of the change it is on. Mo is 16.11.2026.
 */
export { arbeit, pause, schicht, um, weiter } from "../pruefung/testhilfen.ts";

export const SPAETER = um("2030-01-01T00:00Z");

/** A wall-clock time in November 2026 (+01:00), e.g. `uhr("16", "8:00")` */
export const uhr = (tag: string, zeit: string): string =>
  `2026-11-${tag}T${zeit.padStart(5, "0")}+01:00`;
export const MO = "16";
export const DI = "17";

export const spanne = (beginn: string, ende: string): Spanne => ({
  beginn: um(beginn),
  ende: um(ende),
});

export const mitBereitschaft = (
  stempel: Stempelung[],
  eingabe: BereitschaftEingabe,
): BereitschaftsTag[] => {
  const ergebnis = bereitschaftstage(tage(stempel, SPAETER), eingabe);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

export const pruefe = (
  stempel: Stempelung[],
  eingabe: BereitschaftEingabe,
  optionen: Partial<BereitschaftOptionen> = {},
) =>
  bereitschaftBefunde(mitBereitschaft(stempel, eingabe), {
    jetzt: SPAETER,
    feiertage: new Set(),
    neutral: new Set(),
    ...optionen,
  });

/** The rule, kind and days of each finding, for cases that name only these */
export const kurz = (ergebnis: ReturnType<typeof pruefe>) =>
  ergebnis.befunde.map((befund) => [befund.regel, befund.art, befund.tage]);
