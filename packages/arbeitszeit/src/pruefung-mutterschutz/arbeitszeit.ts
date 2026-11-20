import type { Befund } from "../befund.ts";
import { plusTage, type Tag, wochenbeginn } from "../kalender/tag.ts";
import type { MutterschutzGrenzen } from "./grenzen.ts";
import {
  arbeitsMinutenAm,
  fuerGeschuetzte,
  type MutterschutzOptionen,
  minderjaehrig,
  type Pruefergebnis,
  type PruefTag,
  sortiert,
} from "./typen.ts";

/**
 * R-21, § 4 Abs. 1 Satz 1 to 3 MuSchG: a day over 8:30 (`ueber_8_30`; under 18 over 8 hours,
 * `ueber_8h`) or a Doppelwoche over 90 hours (80 under 18), `von` to `bis`. `minuten` is the working
 * time, `grenze` the limit crossed.
 */
export type MutterschutzArbeitszeitBefund = Befund<"ueber_8_30" | "ueber_8h" | "doppelwoche"> & {
  minuten: number;
  grenze: number;
  ueber: number;
  von?: Tag;
  bis?: Tag;
};

type Arbeitstag = { tag: Tag; minuten: number; grenzen: MutterschutzGrenzen; jung: boolean };

const amTag = (tag: Arbeitstag): MutterschutzArbeitszeitBefund[] => {
  const grenze = tag.jung ? tag.grenzen.taeglichMinderjaehrig : tag.grenzen.taeglich;
  if (tag.minuten <= grenze) return [];
  return [
    {
      regel: "R-21",
      norm: tag.jung ? "§ 4 Abs. 1 Satz 2 MuSchG" : "§ 4 Abs. 1 Satz 1 MuSchG",
      schwere: "verstoss",
      art: tag.jung ? "ueber_8h" : "ueber_8_30",
      tage: [tag.tag],
      minuten: tag.minuten,
      grenze,
      ueber: tag.minuten - grenze,
    },
  ];
};

const DOPPELWOCHE = 14;

/**
 * § 4 Abs. 1 Satz 1 and 3: every two consecutive calendar weeks, Sundays included, so each week with
 * the one before and the one after (docs/regeln.md, R-21): no pairing of weeks hides an excess. The
 * limit for women under 18 applies when she is under 18 on any day of the Doppelwoche, worked or
 * not; as age only grows, that is its first day.
 */
const doppelwochen = (
  tage: readonly Arbeitstag[],
  geburtsdatum: Tag | null | undefined,
): MutterschutzArbeitszeitBefund[] => {
  const montage = new Set(
    tage.flatMap((tag) => [wochenbeginn(tag.tag), plusTage(wochenbeginn(tag.tag), -7)]),
  );
  return sortiert(montage).flatMap((von): MutterschutzArbeitszeitBefund[] => {
    const bis = plusTage(von, DOPPELWOCHE - 1);
    const darin = tage.filter((tag) => von <= tag.tag && tag.tag <= bis);
    const erster = darin[0];
    if (erster === undefined) return [];
    const minuten = darin.reduce((summe, tag) => summe + tag.minuten, 0);
    const jung = minderjaehrig(geburtsdatum, von, erster.grenzen);
    const grenze = jung ? erster.grenzen.doppelwocheMinderjaehrig : erster.grenzen.doppelwoche;
    if (minuten <= grenze) return [];
    return [
      {
        regel: "R-21",
        norm: jung ? "§ 4 Abs. 1 Satz 2 und 3 MuSchG" : "§ 4 Abs. 1 Satz 1 und 3 MuSchG",
        schwere: "verstoss",
        art: "doppelwoche",
        tage: darin.map((tag) => tag.tag),
        minuten,
        grenze,
        ueber: minuten - grenze,
        von,
        bis,
      },
    ];
  });
};

/**
 * § 4 Abs. 1 Satz 1 to 3 MuSchG on the working days in a span of the mark (docs/regeln.md, R-21):
 * at most 8:30 a day and 90 hours a Doppelwoche, under 18 or without a birth date 8 and 80 hours.
 * Only the days in the span count.
 */
export const mutterschutzArbeitszeit = (
  tage: readonly PruefTag[],
  optionen: MutterschutzOptionen,
): Pruefergebnis<MutterschutzArbeitszeitBefund> => {
  const sortierteTage = [...tage].sort((a, b) => a.tag.localeCompare(b.tag));
  const { befunde: arbeitstage, nichtHinterlegt } = fuerGeschuetzte(
    sortierteTage,
    (tag) => tag.tag,
    optionen.zeitraeume,
    (tag, grenzen): Arbeitstag[] => {
      const minuten = arbeitsMinutenAm(tag);
      const jung = minderjaehrig(optionen.geburtsdatum, tag.tag, grenzen);
      return minuten === 0 ? [] : [{ tag: tag.tag, minuten, grenzen, jung }];
    },
  );
  return {
    befunde: [...arbeitstage.flatMap(amTag), ...doppelwochen(arbeitstage, optionen.geburtsdatum)],
    nichtHinterlegt,
  };
};
