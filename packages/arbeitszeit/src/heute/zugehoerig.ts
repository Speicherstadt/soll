import { arbeitstage } from "../arbeitstag/arbeitstag.ts";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import type { Tag } from "../kalender/tag.ts";
import { tagInBerlin } from "../kalender/zeit.ts";

const MINUTE = 60_000;

/**
 * The stamps that belong to a working day, in time order: those within a shift that begins on it
 * (a night shift's Gehen after midnight too), and a stamp outside every shift on its Berlin day,
 * where R-01 reports it. A list of the day shows these.
 */
export const stempelungenAm = <S extends Stempelung>(
  stempelungen: readonly S[],
  jetzt: number,
  tag: Tag,
): S[] => {
  const ergebnis = arbeitstage(stempelungen, jetzt);
  if (!ergebnis.ok) return [];
  const schichten = ergebnis.wert.flatMap((eintrag) => eintrag.schichten);
  const tagVon = (zeitpunkt: number): Tag => {
    const schicht = schichten.find(
      (kandidat) =>
        zeitpunkt >= kandidat.beginn &&
        zeitpunkt < (kandidat.ende ?? Math.max(jetzt, kandidat.beginn)) + MINUTE,
    );
    return schicht?.tag ?? tagInBerlin(zeitpunkt);
  };
  return stempelungen
    .filter((stempel) => tagVon(stempel.zeitpunkt) === tag)
    .sort((a, b) => a.zeitpunkt - b.zeitpunkt);
};
