import type { Stueck } from "../arbeitstag/schichten.ts";
import type { Befund } from "../befund.ts";
import { plusTage, type Tag } from "../kalender/tag.ts";
import { zeitpunktInBerlin } from "../kalender/zeit.ts";
import { minutenInNaechten } from "../pruefung-nacht-sonntag/typen.ts";
import type { MutterschutzGrenzen } from "./grenzen.ts";
import {
  fuerGeschuetzte,
  geschlossen,
  type MutterschutzOptionen,
  type Pruefergebnis,
  type PruefTag,
} from "./typen.ts";

/** R-21, § 5 Abs. 1 MuSchG: `minuten` of a working day's work fall into the night */
export type MutterschutzNachtBefund = Befund<"nachtarbeit"> & { minuten: number };

/** § 28: whether the permit covers the evening of a day */
const genehmigt = (optionen: MutterschutzOptionen, tag: Tag): boolean => {
  const genehmigung = optionen.genehmigung28;
  return genehmigung !== undefined && (genehmigung.tage === undefined || genehmigung.tage.has(tag));
};

/** The night that begins on the evening of `tag`: from 20 Uhr, with a permit from 22 Uhr, to 6 Uhr */
const nachtAb =
  (optionen: MutterschutzOptionen, grenzen: MutterschutzGrenzen) =>
  (tag: Tag): Stueck => {
    const spanne = genehmigt(optionen, tag) ? grenzen.nachtGenehmigt : grenzen.nacht;
    const beginn = zeitpunktInBerlin(tag, spanne.von);
    return { beginn, ende: zeitpunktInBerlin(plusTage(tag, 1), spanne.bis), minuten: 0 };
  };

/**
 * § 5 Abs. 1 MuSchG on the working days in a span of the mark (docs/regeln.md, R-21): no work between
 * 20 and 6 Uhr, with a permit under § 28 between 22 and 6 Uhr; wall-clock times in Berlin, real
 * minutes of work, short interruptions included.
 */
export const mutterschutzNacht = (
  tage: readonly PruefTag[],
  optionen: MutterschutzOptionen,
): Pruefergebnis<MutterschutzNachtBefund> =>
  fuerGeschuetzte(
    tage,
    (tag) => tag.tag,
    optionen.zeitraeume,
    (tag, grenzen) => {
      const nacht = nachtAb(optionen, grenzen);
      const minuten = geschlossen(tag)
        .flatMap((schicht) => schicht.bloecke)
        .reduce((summe, block) => summe + minutenInNaechten(block, nacht), 0);
      if (minuten === 0) return [];
      const befund: MutterschutzNachtBefund = {
        regel: "R-21",
        norm: optionen.genehmigung28
          ? "§ 5 Abs. 1 Satz 2, § 28 MuSchG"
          : "§ 5 Abs. 1 Satz 1 MuSchG",
        schwere: "verstoss",
        art: "nachtarbeit",
        tage: [tag.tag],
        minuten,
      };
      return [befund];
    },
  );
