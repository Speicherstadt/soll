import type { Stueck } from "../arbeitstag/schichten.ts";
import type { Befund } from "../befund.ts";
import { alterAm } from "../kalender/alter.ts";
import { plusTage, type Tag } from "../kalender/tag.ts";
import { zeitpunktInBerlin } from "../kalender/zeit.ts";
import { minutenInNaechten } from "../pruefung-nacht-sonntag/typen.ts";
import type { Arbeitsfenster, JugendGrenzen } from "./grenzen.ts";
import {
  fuerJugendliche,
  geschlossen,
  type JugendOptionen,
  type Pruefergebnis,
  type PruefTag,
} from "./typen.ts";

/**
 * R-19, § 14 JArbSchG: `minuten` of a working day's work lie outside the hours allowed, `fenster`
 * (wall clock, minutes after 0:00), on the evening before a Berufsschultag (Abs. 4) until 20 Uhr
 */
export type NachtruheBefund = Befund<"nachtruhe"> & {
  minuten: number;
  fenster: Arbeitsfenster;
};

/**
 * § 14 Abs. 1 to 3: 6 to 20 Uhr, later or earlier from 16 or 17 in the industries named, until
 * 23 Uhr in a business with several shifts, and in agriculture from 5 or until 21 Uhr as chosen
 */
export const arbeitsfensterAm = (
  alter: number,
  optionen: JugendOptionen,
  grenzen: JugendGrenzen,
): Arbeitsfenster => {
  const branche = optionen.branche ?? "andere";
  let { ab, bis } = grenzen.arbeitsfenster;
  for (const eintrag of grenzen.fensterAb)
    if (eintrag.branche === branche && alter >= eintrag.alter) {
      ab = Math.min(ab, eintrag.fenster.ab ?? ab);
      bis = Math.max(bis, eintrag.fenster.bis ?? bis);
    }
  if (optionen.mehrschichtig && alter >= grenzen.mehrschichtigAb.alter)
    bis = Math.max(bis, grenzen.mehrschichtigAb.bis);
  const land = grenzen.landwirtschaftAb;
  if (branche === "landwirtschaft_tierhaltung" && alter >= land.alter) {
    if (optionen.landwirtschaft === "ab_5") ab = Math.min(ab, land.ab);
    if (optionen.landwirtschaft === "bis_21") bis = Math.max(bis, land.bis);
  }
  return { ab, bis };
};

/**
 * § 14 Abs. 4: before a Berufsschultag with lessons before 9 Uhr no work after 20 Uhr, even where
 * Abs. 2 Nr. 1 to 3 allow later hours; without the days entered, every day may be one
 */
const schuleAm = (tag: Tag, optionen: JugendOptionen): boolean =>
  optionen.berufsschuleVor9 === undefined || optionen.berufsschuleVor9.has(tag);

/** The hours of the night that begins on the evening of `tag` in which no work is allowed */
const nachtAb =
  (fenster: Arbeitsfenster, abends: number) =>
  (tag: Tag): Stueck => {
    const beginn = zeitpunktInBerlin(tag, abends);
    const ende = zeitpunktInBerlin(plusTage(tag, 1), fenster.ab);
    return { beginn, ende, minuten: 0 };
  };

const minutenAusserhalb = (bloecke: readonly Stueck[], nacht: (tag: Tag) => Stueck): number =>
  bloecke.reduce((summe, block) => summe + minutenInNaechten(block, nacht), 0);

const amTag = (tag: PruefTag, optionen: JugendOptionen, grenzen: JugendGrenzen) => {
  const fenster = arbeitsfensterAm(alterAm(optionen.geburtsdatum, tag.tag), optionen, grenzen);
  const schule = (abend: Tag) =>
    schuleAm(plusTage(abend, 1), optionen)
      ? Math.min(fenster.bis, grenzen.arbeitsfenster.bis)
      : fenster.bis;
  const bloecke = geschlossen(tag).flatMap((schicht) => schicht.bloecke);
  const minuten = minutenAusserhalb(bloecke, (abend) => nachtAb(fenster, schule(abend))(abend));
  if (minuten === 0) return [];
  const ohneSchule = minutenAusserhalb(bloecke, nachtAb(fenster, fenster.bis));
  const befund: NachtruheBefund = {
    regel: "R-19",
    norm: minuten > ohneSchule ? "§ 14 Abs. 4 JArbSchG" : "§ 14 Abs. 1 JArbSchG",
    schwere: "verstoss",
    art: "nachtruhe",
    tage: [tag.tag],
    minuten,
    fenster,
  };
  return [befund];
};

/**
 * § 14 JArbSchG on the working days of a Jugendlicher (docs/regeln.md, R-19): the real minutes of
 * work, short interruptions included, outside the hours the age and industry of the working day
 * allow, wall-clock times in Berlin.
 */
export const nachtruhe = (
  tage: readonly PruefTag[],
  optionen: JugendOptionen,
): Pruefergebnis<NachtruheBefund> =>
  fuerJugendliche(
    tage,
    (tag) => tag.tag,
    optionen.geburtsdatum,
    (tag, grenzen) => amTag(tag, optionen, grenzen),
  );
