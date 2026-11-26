import type { Stueck } from "../arbeitstag/schichten.ts";
import type { Befund } from "../befund.ts";
import { type ArbzgGrenzen, arbzgGrenzenAm } from "./grenzen.ts";
import {
  geschlossen,
  mitGrenzen,
  type Pruefergebnis,
  type PruefSchicht,
  type PruefTag,
} from "./typen.ts";

/** R-04, § 4 Satz 1 ArbZG: the Ruhepausen of a shift fall short by `fehlt` minutes */
export type PauseFehltBefund = Befund<"pause_fehlt"> & {
  schicht: number;
  arbeitsMinuten: number;
  pausenMinuten: number;
  fehlt: number;
};

/** R-04, § 4 Satz 3 ArbZG: a block of work without a Ruhepause runs `ueber` minutes past 6 hours */
export type OhnePauseBefund = Befund<"ohne_pause"> & {
  schicht: number;
  block: Stueck;
  ueber: number;
};

export type RuhepausenBefund = PauseFehltBefund | OhnePauseBefund;

/** § 4 Satz 1 ArbZG: 30 minutes for more than 6 hours, 45 for more than 9 */
const pauseNoetig = (arbeitsMinuten: number, grenzen: ArbzgGrenzen): number =>
  grenzen.pausen.find((stufe) => arbeitsMinuten > stufe.ab)?.minuten ?? 0;

/**
 * The Ruhepausen of a shift: only interruptions of 15 minutes or more (§ 4 Satz 2 ArbZG), which
 * S-201 marks; a shorter one is working time and is in `arbeitsMinuten` already
 */
const ruhepausenMinuten = (schicht: PruefSchicht): number =>
  schicht.pausen.reduce((summe, pause) => summe + (pause.ruhepause ? pause.minuten : 0), 0);

const zuWenigPause = (schicht: PruefSchicht, grenzen: ArbzgGrenzen): PauseFehltBefund[] => {
  const pausenMinuten = ruhepausenMinuten(schicht);
  const fehlt = pauseNoetig(schicht.arbeitsMinuten, grenzen) - pausenMinuten;
  if (fehlt <= 0) return [];
  return [
    {
      regel: "R-04",
      norm: "§ 4 Satz 1 ArbZG",
      schwere: "verstoss",
      art: "pause_fehlt",
      tage: [schicht.tag],
      schicht: schicht.beginn,
      arbeitsMinuten: schicht.arbeitsMinuten,
      pausenMinuten,
      fehlt,
    },
  ];
};

const zuLangOhnePause = (schicht: PruefSchicht, grenzen: ArbzgGrenzen): OhnePauseBefund[] =>
  schicht.bloecke
    .filter((block) => block.minuten > grenzen.hintereinander)
    .map((block) => ({
      regel: "R-04",
      norm: "§ 4 Satz 3 ArbZG",
      schwere: "verstoss",
      art: "ohne_pause",
      tage: [schicht.tag],
      schicht: schicht.beginn,
      block,
      ueber: block.minuten - grenzen.hintereinander,
    }));

/**
 * § 4 ArbZG per closed shift: the breaks it owes, and each block of work between Ruhepausen. Two
 * shifts of one day are judged apart: between them lie 9 hours or more (S-201), more than any break
 * owed. docs/regeln.md, R-04.
 */
export const ruhepausen = (tage: readonly PruefTag[]): Pruefergebnis<RuhepausenBefund> =>
  mitGrenzen(
    tage.flatMap(geschlossen),
    (schicht) => schicht.tag,
    (schicht, grenzen): RuhepausenBefund[] => [
      ...zuWenigPause(schicht, grenzen),
      ...zuLangOhnePause(schicht, grenzen),
    ],
  );

/**
 * Automatic break deduction for one closed shift (docs/regeln.md, R-04): deducts missing statutory
 * Ruhepausen tier by tier without ever dropping net working time below a tier's threshold (no
 * cliff, monotonically non-decreasing in worked time). Never hides R-04 findings.
 */
export const schichtPausenabzug = (schicht: PruefSchicht, grenzen: ArbzgGrenzen): number => {
  if (schicht.ende === null) return 0;
  let arbeit = schicht.arbeitsMinuten;
  let pause = ruhepausenMinuten(schicht);
  let abzug = 0;
  const stufen = [...grenzen.pausen].sort((a, b) => a.ab - b.ab);
  for (const stufe of stufen) {
    if (arbeit <= stufe.ab) continue;
    const fehlt = Math.max(0, stufe.minuten - pause);
    const teil = Math.min(fehlt, arbeit - stufe.ab);
    arbeit -= teil;
    pause += teil;
    abzug += teil;
  }
  return abzug;
};

/**
 * Total automatic break deduction across the closed shifts of a working day; 0 when inactive or
 * before the first rule version ("nicht hinterlegt").
 */
export const tagesPausenabzug = (tag: PruefTag, aktiv: boolean): number => {
  if (!aktiv) return 0;
  const grenzen = arbzgGrenzenAm(tag.tag);
  if (grenzen === null) return 0;
  return geschlossen(tag).reduce(
    (summe, schicht) => summe + schichtPausenabzug(schicht, grenzen),
    0,
  );
};
