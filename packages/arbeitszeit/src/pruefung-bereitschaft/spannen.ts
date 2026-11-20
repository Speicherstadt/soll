import type { Stueck } from "../arbeitstag/schichten.ts";
import type { Spanne } from "./typen.ts";

/* Spans of time as sets of minutes: union and difference, each result sorted and disjoint. */

export const MINUTE = 60_000;

/**
 * Whole minutes in the employee's favour, as S-201 counts stamps (CLAUDE.md: never round working
 * time to their disadvantage): the start is cut down, the end up
 */
export const aufMinuten = ({ beginn, ende }: Spanne): Spanne => ({
  beginn: Math.floor(beginn / MINUTE) * MINUTE,
  ende: Math.ceil(ende / MINUTE) * MINUTE,
});

export const alsStueck = ({ beginn, ende }: Spanne): Stueck => ({
  beginn,
  ende,
  minuten: (ende - beginn) / MINUTE,
});

export const minutenVon = (spannen: readonly Spanne[]): number =>
  spannen.reduce((summe, { beginn, ende }) => summe + (ende - beginn) / MINUTE, 0);

export const ueberschneiden = (a: Spanne, b: Spanne): boolean =>
  a.beginn < b.ende && b.beginn < a.ende;

/** The union: sorted, and spans that overlap or touch merged into one */
export const vereinigt = (spannen: readonly Spanne[]): Spanne[] => {
  const ergebnis: Spanne[] = [];
  for (const spanne of [...spannen].sort((a, b) => a.beginn - b.beginn)) {
    const letzte = ergebnis.at(-1);
    if (letzte !== undefined && spanne.beginn <= letzte.ende)
      ergebnis[ergebnis.length - 1] = {
        beginn: letzte.beginn,
        ende: Math.max(letzte.ende, spanne.ende),
      };
    else ergebnis.push({ beginn: spanne.beginn, ende: spanne.ende });
  }
  return ergebnis;
};

/** The parts of `spannen` that lie outside every span of `abzug` */
export const ohne = (spannen: readonly Spanne[], abzug: readonly Spanne[]): Spanne[] => {
  const weg = vereinigt(abzug);
  return vereinigt(spannen).flatMap((spanne) => {
    const teile: Spanne[] = [];
    let beginn = spanne.beginn;
    for (const loch of weg) {
      if (loch.ende <= beginn || loch.beginn >= spanne.ende) continue;
      if (loch.beginn > beginn) teile.push({ beginn, ende: loch.beginn });
      beginn = Math.max(beginn, loch.ende);
    }
    if (beginn < spanne.ende) teile.push({ beginn, ende: spanne.ende });
    return teile;
  });
};
