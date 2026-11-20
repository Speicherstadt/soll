import type { Stueck } from "../arbeitstag/schichten.ts";
import type { Befund } from "../befund.ts";
import type { JugendGrenzen } from "./grenzen.ts";
import {
  fuerJugendliche,
  geschlossen,
  type JugendOptionen,
  MINUTE,
  type Pruefergebnis,
  type PruefSchicht,
  type PruefTag,
} from "./typen.ts";

/**
 * R-16, § 11 JArbSchG: the Ruhepausen of a shift fall short by `fehlt` minutes (`pause_fehlt`), a
 * block of work runs `ueber` minutes past 4:30 without one (`ohne_pause`), or a Ruhepause lies less
 * than an hour after the start (`pause_zu_frueh`) or before the end (`pause_zu_spaet`) of the shift,
 * `abstand` minutes from it.
 */
export type JugendPausenBefund = Befund<
  "pause_fehlt" | "ohne_pause" | "pause_zu_frueh" | "pause_zu_spaet"
> & {
  schicht: number;
  fehlt?: number;
  block?: Stueck;
  ueber?: number;
  pause?: Stueck;
  abstand?: number;
};

const befund = (
  art: JugendPausenBefund["art"],
  norm: string,
  schicht: PruefSchicht,
  felder: Partial<JugendPausenBefund>,
): JugendPausenBefund => ({
  regel: "R-16",
  norm,
  schwere: "verstoss",
  art,
  tage: [schicht.tag],
  schicht: schicht.beginn,
  ...felder,
});

/** § 11 Abs. 1 Satz 2: 30 minutes for more than 4:30, 60 for more than 6 hours */
const pauseNoetig = (arbeitsMinuten: number, grenzen: JugendGrenzen): number =>
  grenzen.pausen.find((stufe) => arbeitsMinuten > stufe.ab)?.minuten ?? 0;

/** § 11 Abs. 1 Satz 3: only an interruption of 15 minutes or more, which S-201 marks */
const ruhepausenVon = (schicht: PruefSchicht) => schicht.pausen.filter((pause) => pause.ruhepause);

const zuWenig = (schicht: PruefSchicht, noetig: number): JugendPausenBefund[] => {
  const pausen = ruhepausenVon(schicht).reduce((summe, pause) => summe + pause.minuten, 0);
  return pausen >= noetig
    ? []
    : [befund("pause_fehlt", "§ 11 Abs. 1 JArbSchG", schicht, { fehlt: noetig - pausen })];
};

const zuLang = (schicht: PruefSchicht, grenzen: JugendGrenzen): JugendPausenBefund[] =>
  schicht.bloecke
    .filter((block) => block.minuten > grenzen.hintereinander)
    .map((block) =>
      befund("ohne_pause", "§ 11 Abs. 2 Satz 2 JArbSchG", schicht, {
        block,
        ueber: block.minuten - grenzen.hintereinander,
      }),
    );

/** § 11 Abs. 2 Satz 1: each Ruhepause at least an hour after the start and before the end */
const lage = (schicht: PruefSchicht, grenzen: JugendGrenzen): JugendPausenBefund[] =>
  ruhepausenVon(schicht).flatMap((pause): JugendPausenBefund[] => {
    const ende = schicht.ende ?? pause.ende;
    const nachBeginn = (pause.beginn - schicht.beginn) / MINUTE;
    const vorEnde = (ende - pause.ende) / MINUTE;
    const stueck = { beginn: pause.beginn, ende: pause.ende, minuten: pause.minuten };
    const norm = "§ 11 Abs. 2 Satz 1 JArbSchG";
    return [
      ...(nachBeginn < grenzen.pauseAbstand
        ? [befund("pause_zu_frueh", norm, schicht, { pause: stueck, abstand: nachBeginn })]
        : []),
      ...(vorEnde < grenzen.pauseAbstand
        ? [befund("pause_zu_spaet", norm, schicht, { pause: stueck, abstand: vorEnde })]
        : []),
    ];
  });

const pruefeSchicht = (schicht: PruefSchicht, grenzen: JugendGrenzen): JugendPausenBefund[] => {
  const noetig = pauseNoetig(schicht.arbeitsMinuten, grenzen);
  return [
    ...zuWenig(schicht, noetig),
    ...zuLang(schicht, grenzen),
    ...(noetig > 0 ? lage(schicht, grenzen) : []),
  ];
};

/**
 * § 11 JArbSchG per closed shift of a Jugendlicher (docs/regeln.md, R-16): the breaks it owes, each
 * block of work between Ruhepausen, and where the Ruhepausen of a shift that owes a break lie. Two
 * shifts of a day are judged apart, as in R-04: 9 hours or more lie between them (S-201).
 */
export const jugendRuhepausen = (
  tage: readonly PruefTag[],
  optionen: JugendOptionen,
): Pruefergebnis<JugendPausenBefund> =>
  fuerJugendliche(
    tage.flatMap(geschlossen),
    (schicht) => schicht.tag,
    optionen.geburtsdatum,
    pruefeSchicht,
  );
