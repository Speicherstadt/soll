import { istTag, plusTage, type Tag } from "../kalender/tag.ts";
import { beginnInBerlin, tagInBerlin } from "../kalender/zeit.ts";
import {
  type Gueltig,
  KINDERKRANKENTAGE,
  type Kinderkrankentage,
  MINDESTLOHN,
  MINIJOB_GRENZE,
  REGELVERSIONEN,
} from "./werte.ts";

export type Jahreswert<T> =
  | { ok: true; wert: T; quelle: string }
  | { ok: false; grund: "nicht_hinterlegt" | "kein_tag" };

const NICHT_HINTERLEGT = { ok: false, grund: "nicht_hinterlegt" } as const;

/** The entry of a table in force on a day; none is "nicht hinterlegt", never a neighbour's value */
const wertAm =
  <T>(tabelle: readonly Gueltig<T>[]) =>
  (tag: Tag): Jahreswert<T> => {
    if (!istTag(tag)) return { ok: false, grund: "kein_tag" };
    const eintrag = tabelle.find(({ von, bis }) => von <= tag && (bis === null || tag <= bis));
    return eintrag ? { ok: true, wert: eintrag.wert, quelle: eintrag.quelle } : NICHT_HINTERLEGT;
  };

/** Minimum wage in cents per hour */
export const mindestlohnAm = wertAm(MINDESTLOHN);
/** Mini-job limit in cents per month */
export const minijobGrenzeAm = wertAm(MINIJOB_GRENZE);
export const regelversionAm = wertAm(REGELVERSIONEN);

/** § 8 Abs. 1a SGB IV: minimum wage × 130 ÷ 3, rounded up to whole euros; in cents, without floats */
export const minijobGrenzeAus = (mindestlohnCent: number): number => {
  const zaehler = mindestlohnCent * 130;
  const rest = zaehler % 300;
  return ((zaehler - rest) / 300 + (rest > 0 ? 1 : 0)) * 100;
};

export const kinderkrankentage = (jahr: number): Jahreswert<Kinderkrankentage> => {
  const eintrag = KINDERKRANKENTAGE.find((kandidat) => kandidat.jahr === jahr);
  return eintrag ? { ok: true, wert: eintrag.wert, quelle: eintrag.quelle } : NICHT_HINTERLEGT;
};

export type Abschnitt<T> = { beginn: number; ende: number; minuten: number; wert: Jahreswert<T> };

const MINUTE = 60_000;

/** The instants a Tag can name: before 0000-01-01 and past 9999-12-31 there is no day to look up */
const ERSTER_BEGINN = beginnInBerlin("0000-01-01");
const LETZTER_BEGINN = beginnInBerlin("9999-12-31");

/**
 * The cut at a Berlin midnight, on a whole minute: midnight fell between minutes only under local
 * mean time (before April 1893); the minute it falls in goes to the new day, rounding no time away.
 */
const grenzeAm = (tag: Tag): number => Math.ceil(beginnInBerlin(tag) / MINUTE) * MINUTE;

const gleich = <T>(a: Jahreswert<T>, b: Jahreswert<T>) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A span of work (UTC milliseconds, whole minutes) cut wherever the value changes at a Berlin
 * midnight, e.g. a night shift over 1 January into the hours at the old and at the new minimum wage.
 * Values are valid for calendar days, so a change can only fall on midnight.
 */
export const abschnitte = <T>(
  beginn: number,
  ende: number,
  wertAmTag: (tag: Tag) => Jahreswert<T>,
): { ok: true; wert: Abschnitt<T>[] } | { ok: false; grund: "ungueltig" } => {
  const ausserhalb = beginn < ERSTER_BEGINN || ende > LETZTER_BEGINN;
  if (ende <= beginn || beginn % MINUTE !== 0 || ende % MINUTE !== 0 || ausserhalb)
    return { ok: false, grund: "ungueltig" };
  const teile: Abschnitt<T>[] = [];
  let teilBeginn = beginn;
  let wert = wertAmTag(tagInBerlin(beginn));
  for (let tag = plusTage(tagInBerlin(beginn), 1); grenzeAm(tag) < ende; tag = plusTage(tag, 1)) {
    const neu = wertAmTag(tag);
    if (gleich(neu, wert)) continue;
    const grenze = grenzeAm(tag);
    teile.push({ beginn: teilBeginn, ende: grenze, minuten: (grenze - teilBeginn) / MINUTE, wert });
    teilBeginn = grenze;
    wert = neu;
  }
  teile.push({ beginn: teilBeginn, ende, minuten: (ende - teilBeginn) / MINUTE, wert });
  return { ok: true, wert: teile };
};
