import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import { gehen, kommen, um } from "../arbeitstag/testhilfen.ts";
import type { Tag } from "../kalender/tag.ts";
import { beginnInBerlin } from "../kalender/zeit.ts";
import type { PruefTag } from "./typen.ts";

/*
 * Helpers for the tests of §§ 3 to 5 ArbZG. Wall-clock times carry their UTC offset, as in the tests
 * of the working day, so every DST case states which side of the change it is on.
 */
export { gehen, kommen, pause, tage, um, weiter } from "../arbeitstag/testhilfen.ts";

const MINUTE = 60_000;

/** Kommen and Gehen `minuten` apart, starting at a wall-clock time with its offset */
export const arbeit = (beginn: string, minuten: number): Stempelung[] => [
  kommen(beginn),
  { art: "gehen", zeitpunkt: um(beginn) + minuten * MINUTE },
];

/** A shift from Kommen to Gehen, both wall-clock times with their offset */
export const schicht = (beginn: string, ende: string): Stempelung[] => [
  kommen(beginn),
  gehen(ende),
];

/**
 * A working day with one closed shift of `minuten` from 8:00 on, without breaks: enough for the
 * average of § 3 Satz 2 ArbZG, which reads only the minutes of each day
 */
export const tagMit = (tag: Tag, minuten: number): PruefTag => {
  const beginn = beginnInBerlin(tag) + 8 * 60 * MINUTE;
  const ende = beginn + minuten * MINUTE;
  const stueck = { beginn, ende, minuten };
  return {
    tag,
    schichten: [{ tag, beginn, ende, arbeitsMinuten: minuten, pausen: [], bloecke: [stueck] }],
  };
};
