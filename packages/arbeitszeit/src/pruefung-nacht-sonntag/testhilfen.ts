import type { Standort } from "../feiertage/laender.ts";
import { plusTage, type Tag, wochentag } from "../kalender/tag.ts";
import { zeitpunktInBerlin } from "../kalender/zeit.ts";
import type { PruefTag } from "./typen.ts";

/*
 * Helpers for the tests of §§ 2, 6, 9 to 11 ArbZG. Single cases go through the stamps of S-201
 * (pruefung/testhilfen.ts); long stretches of days are built as working days directly.
 */
export { schicht, tage } from "../pruefung/testhilfen.ts";

export const HAMBURG: Standort = { land: "HH" };
export const BAYERN: Standort = { land: "BY" };

const MINUTE = 60_000;

/** A working day with one closed shift of `minuten` from a Berlin wall-clock time, without breaks */
export const tagAb = (tag: Tag, uhr: string, minuten: number): PruefTag => {
  const [stunde = 0, minute = 0] = uhr.split(":").map(Number);
  const beginn = zeitpunktInBerlin(tag, stunde * 60 + minute);
  const ende = beginn + minuten * MINUTE;
  return {
    tag,
    schichten: [
      {
        tag,
        beginn,
        ende,
        arbeitsMinuten: minuten,
        pausen: [],
        bloecke: [{ beginn, ende, minuten }],
      },
    ],
  };
};

/** Every day from `von` to `bis` that `nehmen` accepts, both included */
export const tageVonBis = (von: Tag, bis: Tag, nehmen: (tag: Tag) => boolean = () => true) => {
  const liste: Tag[] = [];
  for (let tag = von; tag <= bis; tag = plusTage(tag, 1)) if (nehmen(tag)) liste.push(tag);
  return liste;
};

export const istSonntag = (tag: Tag) => wochentag(tag) === 0;

/** Berlin midnight at the start of a day as `jetzt` */
export const am = (tag: Tag) => zeitpunktInBerlin(tag, 0);
