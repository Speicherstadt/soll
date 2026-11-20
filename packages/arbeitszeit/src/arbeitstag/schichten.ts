import { plusTage, type Tag } from "../kalender/tag.ts";
import { beginnInBerlin, tagInBerlin } from "../kalender/zeit.ts";
import type { Rohstueck } from "./stempelungen.ts";

/** A span in UTC milliseconds on whole minutes, with its length in minutes */
export type Stueck = { beginn: number; ende: number; minuten: number };

/**
 * An interruption between two stretches of work: stamped (Pause-Beginn to Pause-Ende) or a gap
 * (Gehen to the next Kommen). Only a Ruhepause of at least 15 minutes is a break; a shorter one is
 * working time (§ 4 Satz 2 ArbZG; docs/regeln.md, R-04).
 */
export type Pause = Stueck & { art: "gestempelt" | "luecke"; ruhepause: boolean };

/** What is still open in a shift: from `faellig` on it is a finding (docs/regeln.md, R-01) */
export type Offen = { art: "gehen" | "pause_ende"; seit: number; faellig: number };

export type Schicht = {
  tag: Tag;
  beginn: number;
  /** null while the shift is open: Soll never ends it itself */
  ende: number | null;
  /** the stretches of work as stamped, without the interruptions */
  arbeit: Stueck[];
  pausen: Pause[];
  /** the work between Ruhepausen, short interruptions included (§ 4 Satz 3 ArbZG) */
  bloecke: Stueck[];
  arbeitsMinuten: number;
  pausenMinuten: number;
  offen: Offen | null;
};

const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;

/**
 * Time off from 9 hours on ends a shift: the shortest rest the law allows at all is 11 hours
 * shortened by up to two (§ 5 Abs. 1 with § 7 Abs. 1 Nr. 3 ArbZG), so anything shorter is an
 * interruption of the same Werktag, and the rest is left for S-202 to judge (§ 5 ArbZG).
 */
export const NEUE_SCHICHT_AB = 9 * STUNDE;
/** A shift never reaches 24 hours past its start: § 3 ArbZG counts the Werktag from its beginning */
export const LAENGSTE_SCHICHT = 24 * STUNDE;
/**
 * R-01: an open night shift is reported 16 h after it began, a day shift at midnight, and any shift
 * 24 h after it began at the latest: from then on no stamp can end it (a day of 25 hours)
 */
const OFFEN_HOECHSTENS = 16 * STUNDE;
/** § 4 Satz 2 ArbZG: Ruhepausen in blocks of at least 15 minutes */
const KLEINSTE_RUHEPAUSE = 15;

/**
 * Walks a list and folds each element into the last entry of the result when `vereine` returns the
 * merged entry, else appends `neu(element)`. Shifts, whole minutes and blocks all merge neighbours.
 */
const fasseZusammen = <E, T>(
  liste: readonly E[],
  neu: (element: E, index: number) => T,
  vereine: (letztes: T, element: E, index: number) => T | null,
): T[] => {
  const ergebnis: T[] = [];
  liste.forEach((element, index) => {
    const letztes = ergebnis.at(-1);
    const vereint = letztes === undefined ? null : vereine(letztes, element, index);
    if (vereint === null) ergebnis.push(neu(element, index));
    else ergebnis[ergebnis.length - 1] = vereint;
  });
  return ergebnis;
};

/** The stretches of each shift, as indexes into the stretches stamped */
export const schichtgruppen = (stuecke: readonly Rohstueck[]): number[][] =>
  fasseZusammen(
    stuecke,
    (_, index) => [index],
    (gruppe, stueck, index) => {
      const erstes = stuecke[gruppe[0] as number] as Rohstueck;
      const vorher = stuecke[index - 1] as Rohstueck;
      const neu =
        stueck.beginn - (vorher.ende ?? vorher.beginn) >= NEUE_SCHICHT_AB ||
        stueck.beginn - erstes.beginn >= LAENGSTE_SCHICHT;
      return neu ? null : [...gruppe, index];
    },
  );

type Minutenstueck = { beginn: number; ende: number | null; endetMit: Rohstueck["endetMit"] };

/**
 * Whole minutes in the employee's favour (CLAUDE.md: never round working time to their
 * disadvantage): a start is cut down, an end up. Stretches that then touch or overlap merge: an
 * interruption shorter than a minute is no break.
 */
const aufMinuten = (stuecke: readonly Rohstueck[]): Minutenstueck[] =>
  fasseZusammen(
    stuecke.map((stueck) => ({
      beginn: Math.floor(stueck.beginn / MINUTE) * MINUTE,
      ende: stueck.ende === null ? null : Math.ceil(stueck.ende / MINUTE) * MINUTE,
      endetMit: stueck.endetMit,
    })),
    (stueck) => stueck,
    (vorher, stueck) =>
      vorher.ende !== null && stueck.beginn <= vorher.ende
        ? {
            beginn: vorher.beginn,
            ende: stueck.ende === null ? null : Math.max(stueck.ende, vorher.ende),
            endetMit: stueck.endetMit,
          }
        : null,
  );

const stueck = (beginn: number, ende: number): Stueck => ({
  beginn,
  ende,
  minuten: (ende - beginn) / MINUTE,
});

const summe = (teile: readonly { minuten: number }[]): number =>
  teile.reduce((gesamt, teil) => gesamt + teil.minuten, 0);

const pausenZwischen = (teile: readonly Minutenstueck[]): Pause[] =>
  teile.slice(1).map((nach, index) => {
    const vor = teile[index] as Minutenstueck;
    const pause = stueck(vor.ende as number, nach.beginn);
    const art = vor.endetMit === "pause_beginn" ? "gestempelt" : "luecke";
    return { ...pause, art, ruhepause: pause.minuten >= KLEINSTE_RUHEPAUSE };
  });

/** The work from one Ruhepause to the next; a short interruption stays inside the block */
const bloeckeAus = (arbeit: readonly Stueck[], pausen: readonly Pause[]): Stueck[] =>
  fasseZusammen(
    arbeit,
    (teil) => teil,
    (block, teil, index) =>
      pausen[index - 1]?.ruhepause === false ? stueck(block.beginn, teil.ende) : null,
  );

const offenAus = (
  letztes: Minutenstueck,
  pauseLaeuft: boolean,
  tag: Tag,
  beginn: number,
): Offen | null => {
  const faellig = Math.min(
    Math.max(beginnInBerlin(plusTage(tag, 1)), beginn + OFFEN_HOECHSTENS),
    beginn + LAENGSTE_SCHICHT,
  );
  if (letztes.ende === null) return { art: "gehen", seit: letztes.beginn, faellig };
  if (pauseLaeuft) return { art: "pause_ende", seit: letztes.ende, faellig };
  return null;
};

/** A shift from its stretches; `pauseLaeuft` when its last stamp began a break that has not ended */
export const schichtAus = (stuecke: readonly Rohstueck[], pauseLaeuft: boolean): Schicht => {
  const teile = aufMinuten(stuecke);
  const erstes = teile[0] as Minutenstueck;
  const letztes = teile.at(-1) as Minutenstueck;
  const tag = tagInBerlin(erstes.beginn);
  const geschlossen = teile.filter((teil) => teil.ende !== null);
  const arbeit = geschlossen.map((teil) => stueck(teil.beginn, teil.ende as number));
  // only the last stretch can be open; the break before it is known all the same
  const pausen = pausenZwischen(teile);
  const bloecke = bloeckeAus(arbeit, pausen);
  const offen = offenAus(letztes, pauseLaeuft, tag, erstes.beginn);
  return {
    tag,
    beginn: erstes.beginn,
    ende: offen === null ? letztes.ende : null,
    arbeit,
    pausen,
    bloecke,
    arbeitsMinuten: summe(bloecke),
    pausenMinuten: summe(pausen.filter((pause) => pause.ruhepause)),
    offen,
  };
};
