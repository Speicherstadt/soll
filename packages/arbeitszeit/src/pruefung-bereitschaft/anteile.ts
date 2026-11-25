import { LAENGSTE_SCHICHT, NEUE_SCHICHT_AB } from "../arbeitstag/schichten.ts";
import type { Tag } from "../kalender/tag.ts";
import { tagInBerlin } from "../kalender/zeit.ts";
import type { PruefSchicht, PruefTag } from "../pruefung/typen.ts";
import { bereitschaftstage } from "./bereitschaftstage.ts";
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

/** A call-out with the working day its record names */
export type Einsatzeintrag = Einsatzspanne & { tag: Tag };

const innerhalb = (schicht: PruefSchicht, zeitpunkt: number): boolean =>
  schicht.ende !== null && schicht.beginn <= zeitpunkt && zeitpunkt < schicht.ende;

/**
 * The minutes the call-outs add to the stamped working days, per working day (R-12, review of
 * S-505): each call-out's own minutes on the day its record names (`einsatzAnteile`), and a gap under
 * 15 minutes between a call-out and other work, which is working time within the joined shift (R-04,
 * `bereitschaftstage`), on the day of the stamped work of that shift, else of its first call-out. So
 * the day of the stamps never changes and the sum is what the same times would give stamped.
 */
export const zusatzMinutenJeTag = (
  gestempelt: readonly PruefTag[],
  einsaetze: readonly Einsatzeintrag[],
): Map<Tag, number> => {
  const anteile = einsatzAnteile(gestempelt, einsaetze);
  const jeTag = new Map<Tag, number>();
  const dazu = (tag: Tag, minuten: number) => {
    if (minuten > 0) jeTag.set(tag, (jeTag.get(tag) ?? 0) + minuten);
  };
  einsaetze.forEach(({ tag }, index) => {
    dazu(tag, anteile[index]?.minuten ?? 0);
  });
  const geschlossen = einsaetze.flatMap(({ beginn, ende }) =>
    ende === null ? [] : [{ beginn, ende }],
  );
  const verbunden = bereitschaftstage(gestempelt, { einsaetze: geschlossen });
  if (!verbunden.ok) return jeTag;
  const stempelschichten = gestempelt.flatMap((tag) =>
    tag.schichten.filter((s) => s.ende !== null).map((schicht) => ({ tag: tag.tag, schicht })),
  );
  for (const schicht of verbunden.wert.flatMap((tag) => tag.schichten)) {
    const gestempeltDarin = stempelschichten.filter((s) => innerhalb(schicht, s.schicht.beginn));
    const einsaetzeDarin = einsaetze.flatMap((einsatz, index) =>
      innerhalb(schicht, einsatz.beginn)
        ? [{ einsatz, minuten: anteile[index]?.minuten ?? 0 }]
        : [],
    );
    if (einsaetzeDarin.length === 0) continue;
    const luecke =
      schicht.arbeitsMinuten -
      gestempeltDarin.reduce((summe, s) => summe + s.schicht.arbeitsMinuten, 0) -
      einsaetzeDarin.reduce((summe, e) => summe + e.minuten, 0);
    const tag = gestempeltDarin[0]?.tag ?? einsaetzeDarin[0]?.einsatz.tag;
    if (tag !== undefined) dazu(tag, luecke);
  }
  return jeTag;
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
