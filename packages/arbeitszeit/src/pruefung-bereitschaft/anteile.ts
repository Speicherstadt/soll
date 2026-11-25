import { LAENGSTE_SCHICHT, NEUE_SCHICHT_AB } from "../arbeitstag/schichten.ts";
import type { Tag } from "../kalender/tag.ts";
import { tagInBerlin } from "../kalender/zeit.ts";
import type { PruefSchicht, PruefTag } from "../pruefung/typen.ts";
import { aufMinuten, minutenVon, ohne } from "./spannen.ts";
import type { Spanne } from "./typen.ts";

/*
 * What a call-out adds to the record of times (R-12, review of S-505): its working day and its
 * minutes. Stamped work keeps the working day of its stamps; a call-out never moves it, so records,
 * the lock of a closed month and the Ist always agree. The rules of §§ 3 to 5 read the joined shifts
 * of `bereitschaftstage` instead, where a call-out can belong to the rest of the work.
 */

/** A call-out from the call to the end of work; `ende` null while it runs */
export type Einsatzspanne = { beginn: number; ende: number | null };

/**
 * The working day a call-out counts on, its minutes not already counted elsewhere and the stretches
 * they lie in (for the surcharges of § 3b EStG)
 */
export type EinsatzAnteil = { tag: Tag; minuten: number; teile: Spanne[] };

/**
 * The stamped stretches of the days; an open shift holds everything from its start up to 24 hours,
 * the longest a shift can be (Grundbegriff „Schicht“), so a forgotten Gehen hides no later call-out
 */
const gestempelt = (tage: readonly PruefTag[]): Spanne[] =>
  tage.flatMap((tag) =>
    tag.schichten.flatMap((schicht): Spanne[] =>
      schicht.ende === null
        ? [{ beginn: schicht.beginn, ende: schicht.beginn + LAENGSTE_SCHICHT }]
        : schicht.bloecke.map(({ beginn, ende }) => ({ beginn, ende })),
    ),
  );

/**
 * The stamped shift a call-out belongs to by the Grundbegriff „Schicht“: one it lies in, or the last
 * that ended less than 9 hours before it and began less than 24 hours before it
 */
const schichtVor = (
  tage: readonly PruefTag[],
  beginn: number,
): { tag: Tag; schicht: PruefSchicht } | undefined =>
  tage
    .flatMap((tag) => tag.schichten.map((schicht) => ({ tag: tag.tag, schicht })))
    .filter(
      ({ schicht }) =>
        schicht.beginn <= beginn &&
        beginn - schicht.beginn < LAENGSTE_SCHICHT &&
        (schicht.ende === null || beginn - schicht.ende < NEUE_SCHICHT_AB),
    )
    .sort((a, b) => a.schicht.beginn - b.schicht.beginn)
    .at(-1);

/**
 * The working day and minutes of each call-out, in the order given: the day of the stamped shift it
 * belongs to (R-12), else the Berlin day it begins on. Its minutes are whole minutes in the person's
 * favour, without what is stamped at the same time and without what an earlier call-out of the
 * list already counts; a running call-out counts nothing yet (R-01).
 */
export const einsatzAnteile = (
  tage: readonly PruefTag[],
  einsaetze: readonly Einsatzspanne[],
): EinsatzAnteil[] => {
  const gezaehlt: Spanne[] = gestempelt(tage);
  return einsaetze.map(({ beginn, ende }) => {
    const tag = schichtVor(tage, beginn)?.tag ?? tagInBerlin(beginn);
    if (ende === null) return { tag, minuten: 0, teile: [] };
    const spanne = aufMinuten({ beginn, ende });
    const teile = ohne([spanne], gezaehlt);
    gezaehlt.push(spanne);
    return { tag, minuten: minutenVon(teile), teile };
  });
};

/** The minutes of the call-outs per working day */
export const einsatzMinutenJeTag = (
  tage: readonly PruefTag[],
  einsaetze: readonly Einsatzspanne[],
): Map<Tag, number> => {
  const jeTag = new Map<Tag, number>();
  for (const { tag, minuten } of einsatzAnteile(tage, einsaetze))
    jeTag.set(tag, (jeTag.get(tag) ?? 0) + minuten);
  return jeTag;
};
