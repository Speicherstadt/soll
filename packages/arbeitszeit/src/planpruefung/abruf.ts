import type { Befund } from "../befund.ts";
import { schichtMinuten } from "../dienstplan/zeiten.ts";
import { regelversionAm } from "../jahreswerte/jahreswerte.ts";
import { type Tag, tageZwischen } from "../kalender/tag.ts";
import { nachTag, type Pruefergebnis, sortiert } from "../pruefung/typen.ts";

/**
 * A shift of a person who works on call (Arbeit auf Abruf, § 12 TzBfG): when its time was told
 * (`mitteilung`, the day it was published, S-503) and the daily duration the contract agrees, null
 * when it agrees none
 */
export type AbrufSchicht = {
  schichtId: string;
  tag: Tag;
  beginn: number;
  ende: number;
  pauseMinuten: number;
  mitteilung: Tag;
  tagesdauer: number | null;
};

/**
 * R-22: `vorlauf`, the time was told fewer than four days ahead (`vorlaufTage`: the whole days between
 * the day it was told and the day of work); `mindestdauer`, a call without an agreed daily duration
 * for fewer than three hours in a row (`minuten`). A Hinweis: the person need not come, the shift
 * itself is not forbidden.
 */
export type AbrufBefund = Befund<"vorlauf" | "mindestdauer"> & {
  schichtId: string;
  vorlaufTage?: number;
  minuten?: number;
};

/** § 12 Abs. 3 Satz 2 TzBfG: „jeweils mindestens vier Tage im Voraus“ */
const VORLAUF_TAGE = 4;
/** § 12 Abs. 1 Satz 4 TzBfG: „mindestens drei aufeinanderfolgende Stunden“ */
const MINDESTDAUER = 3 * 60;

/**
 * The whole days between the day the time was told and the day of work: neither counts (§ 187
 * Abs. 1 BGB, docs/regeln.md R-22), so told on a Monday, the earliest day of work is Saturday
 */
const volleTage = (mitteilung: Tag, tag: Tag): number =>
  Math.max(0, tageZwischen(mitteilung, tag) - 1);

const befundeEiner = (schicht: AbrufSchicht): AbrufBefund[] => {
  const befunde: AbrufBefund[] = [];
  const vorlaufTage = volleTage(schicht.mitteilung, schicht.tag);
  if (vorlaufTage < VORLAUF_TAGE)
    befunde.push({
      regel: "R-22",
      norm: "§ 12 Abs. 3 Satz 2 TzBfG",
      schwere: "hinweis",
      art: "vorlauf",
      tage: [schicht.tag],
      schichtId: schicht.schichtId,
      vorlaufTage,
    });
  const minuten = schichtMinuten(schicht);
  if (schicht.tagesdauer === null && minuten < MINDESTDAUER)
    befunde.push({
      regel: "R-22",
      norm: "§ 12 Abs. 1 Satz 4 TzBfG",
      schwere: "hinweis",
      art: "mindestdauer",
      tage: [schicht.tag],
      schichtId: schicht.schichtId,
      minuten,
    });
  return befunde;
};

/**
 * § 12 Abs. 1 and 3 TzBfG on the planned shifts of a person on call (docs/regeln.md, R-22): the
 * findings in calendar order, and the days no rule version covers
 */
export const abrufBefunde = (schichten: readonly AbrufSchicht[]): Pruefergebnis<AbrufBefund> => {
  const befunde: AbrufBefund[] = [];
  const nichtHinterlegt: Tag[] = [];
  for (const schicht of schichten) {
    if (regelversionAm(schicht.tag).ok) befunde.push(...befundeEiner(schicht));
    else nichtHinterlegt.push(schicht.tag);
  }
  return { befunde: nachTag(befunde), nichtHinterlegt: sortiert(nichtHinterlegt) };
};
