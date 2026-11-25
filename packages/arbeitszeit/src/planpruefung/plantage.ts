import {
  LAENGSTE_SCHICHT,
  NEUE_SCHICHT_AB,
  type Pause,
  type Stueck,
} from "../arbeitstag/schichten.ts";
import type { PlanSchicht } from "../dienstplan/typen.ts";
import type { Tag } from "../kalender/tag.ts";
import type { PruefSchicht, PruefTag } from "../pruefung/typen.ts";

/*
 * Planned shifts in the shape the rules read (S-502): the same `PruefTag` as the working days built
 * from stamps (S-201), so one check serves Ist and Plan (docs/plan.md, "Prüfung nach §§ 3 bis 5").
 */

const MINUTE = 60_000;
/** § 4 Satz 2 ArbZG: a Ruhepause lasts at least 15 minutes; a shorter break is working time */
const KLEINSTE_RUHEPAUSE = 15;

const stueck = (beginn: number, ende: number): Stueck => ({
  beginn,
  ende,
  minuten: Math.round((ende - beginn) / MINUTE),
});

/**
 * The work of a planned shift. A plan names the length of the break, not its place: a Ruhepause
 * sits in the middle of the working time, the placement that leaves the shortest blocks, so only
 * what every placement violates is a finding of § 4 Satz 3 ArbZG (docs/plan.md, "Pause im Plan").
 * A break under 15 minutes is no Ruhepause and counts as working time (§ 4 Satz 2 ArbZG, R-04).
 */
export const arbeitImPlan = (schicht: PlanSchicht): Stueck[] => {
  const ganz = stueck(schicht.beginn, schicht.ende);
  if (schicht.pauseMinuten < KLEINSTE_RUHEPAUSE) return [ganz];
  const erste = Math.floor((ganz.minuten - schicht.pauseMinuten) / 2);
  const pauseBeginn = schicht.beginn + erste * MINUTE;
  return [
    stueck(schicht.beginn, pauseBeginn),
    stueck(pauseBeginn + schicht.pauseMinuten * MINUTE, schicht.ende),
  ];
};

/** Stretches of work in order, overlaps joined (a person planned twice at once works once) */
const vereinigt = (stuecke: readonly Stueck[]): Stueck[] =>
  [...stuecke]
    .sort((a, b) => a.beginn - b.beginn)
    .reduce<Stueck[]>((liste, neu) => {
      const letztes = liste.at(-1);
      if (letztes && neu.beginn <= letztes.ende) {
        liste[liste.length - 1] = stueck(letztes.beginn, Math.max(letztes.ende, neu.ende));
      } else liste.push(neu);
      return liste;
    }, []);

/** The stretches between Ruhepausen: a gap under 15 minutes is working time and joins them */
const bloeckeAus = (arbeit: readonly Stueck[]): Stueck[] =>
  arbeit.reduce<Stueck[]>((liste, neu) => {
    const letztes = liste.at(-1);
    if (letztes && neu.beginn - letztes.ende < KLEINSTE_RUHEPAUSE * MINUTE) {
      liste[liste.length - 1] = stueck(letztes.beginn, neu.ende);
    } else liste.push(neu);
    return liste;
  }, []);

/** One shift as the rules read it, from the planned shifts that form it */
const pruefSchicht = (gruppe: readonly PlanSchicht[]): PruefSchicht => {
  const bloecke = bloeckeAus(vereinigt(gruppe.flatMap(arbeitImPlan)));
  const pausen: Pause[] = bloecke.slice(1).map((block, index) => ({
    ...stueck((bloecke[index] as Stueck).ende, block.beginn),
    // a break within a planned shift is "gestempelt" in the sense of fixed in advance (§ 4 Satz 1)
    art: "gestempelt",
    ruhepause: true,
  }));
  const erste = bloecke[0] as Stueck;
  return {
    tag: (gruppe[0] as PlanSchicht).tag,
    beginn: erste.beginn,
    ende: (bloecke.at(-1) as Stueck).ende,
    pausen,
    bloecke,
    arbeitsMinuten: bloecke.reduce((summe, block) => summe + block.minuten, 0),
  };
};

/**
 * Planned shifts of one person grouped into shifts as S-201 groups stamps: a gap of 9 hours or more
 * begins a new shift, as does a start 24 hours after the shift began; a split shift (10:00 to 14:00
 * and 17:00 to 22:00) is one shift of its first day with a Ruhepause between.
 */
const gruppiert = (schichten: readonly PlanSchicht[]): PlanSchicht[][] => {
  const gruppen: { schichten: PlanSchicht[]; beginn: number; ende: number }[] = [];
  for (const schicht of [...schichten].sort((a, b) => a.beginn - b.beginn)) {
    const letzte = gruppen.at(-1);
    if (
      letzte &&
      schicht.beginn - letzte.ende < NEUE_SCHICHT_AB &&
      schicht.beginn - letzte.beginn < LAENGSTE_SCHICHT
    ) {
      letzte.schichten.push(schicht);
      letzte.ende = Math.max(letzte.ende, schicht.ende);
    } else gruppen.push({ schichten: [schicht], beginn: schicht.beginn, ende: schicht.ende });
  }
  return gruppen.map((gruppe) => gruppe.schichten);
};

export type PlanTage = {
  /** the working days, in calendar order */
  tage: PruefTag[];
  /** the working day of each planned shift: the first day of the shift it belongs to */
  tagVon: ReadonlyMap<string, Tag>;
};

/**
 * One person's working days for a check of the plan: the days before `ab` as stamped (`ist`), the
 * days from `ab` on as planned. What was worked is what counts; what lies ahead is the plan.
 */
export const planTage = (
  schichten: readonly PlanSchicht[],
  ist: readonly PruefTag[],
  ab: Tag,
): PlanTage => {
  const tagVon = new Map<string, Tag>();
  const jeTag = new Map<Tag, PruefSchicht[]>();
  for (const tag of ist.filter((t) => t.tag < ab)) jeTag.set(tag.tag, [...tag.schichten]);
  for (const gruppe of gruppiert(schichten.filter((schicht) => schicht.tag >= ab))) {
    const schicht = pruefSchicht(gruppe);
    for (const geplant of gruppe) tagVon.set(geplant.schichtId, schicht.tag);
    jeTag.set(schicht.tag, [...(jeTag.get(schicht.tag) ?? []), schicht]);
  }
  const tage = [...jeTag.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, liste]) => ({ tag, schichten: liste.sort((a, b) => a.beginn - b.beginn) }));
  return { tage, tagVon };
};
