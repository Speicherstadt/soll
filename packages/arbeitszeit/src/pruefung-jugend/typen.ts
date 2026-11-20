import type { Standort } from "../feiertage/laender.ts";
import { alterAm } from "../kalender/alter.ts";
import type { Tag } from "../kalender/tag.ts";
import { type JugendBranche, type JugendGrenzen, jugendGrenzenAm } from "./grenzen.ts";

/*
 * Shapes and helpers of the checks of the JArbSchG on top of the working days of S-202
 * (pruefung/typen.ts): the same `PruefTag`, the same `Pruefergebnis`.
 */
export {
  arbeitsMinutenAm,
  geschlossen,
  nachTag,
  type Pruefergebnis,
  type PruefSchicht,
  type PruefTag,
  sortiert,
} from "../pruefung/typen.ts";

/**
 * What the checks of the JArbSchG need besides the working days. Only the birth date comes from the
 * person; everything else is a setting of the business, whose default is never less strict than the
 * law (docs/regeln.md, "Jugendliche").
 */
export type JugendOptionen = {
  /** § 2 Abs. 2 JArbSchG: the rules apply on every day before the 18th birthday */
  geburtsdatum: Tag;
  /** the place of work: its Land and regions decide the holidays (S-105) */
  standort: Standort;
  /** §§ 12, 14, 16, 17: default "andere" */
  branche?: JugendBranche;
  /** § 14 Abs. 2 Nr. 2: a business with several shifts; default false */
  mehrschichtig?: boolean;
  /** § 14 Abs. 2 Nr. 3: in agriculture „ab 5 Uhr oder bis 21 Uhr“; default neither (6 to 20 Uhr) */
  landwirtschaft?: "ab_5" | "bis_21";
  /** § 12: the days on Bau- und Montagestellen (11 hours of Schichtzeit); default none */
  montagetage?: ReadonlySet<Tag>;
  /**
   * § 14 Abs. 4: the Berufsschultage with lessons before 9 Uhr; default unknown, and then every day
   * may be one, so no work after 20 Uhr
   */
  berufsschuleVor9?: ReadonlySet<Tag>;
  /** § 16 Abs. 2 Nr. 1 to 11 and § 17 Abs. 2 Nr. 1 to 8 beyond those of the industry; default none */
  samstag?: readonly number[];
  sonntag?: readonly number[];
  /**
   * § 4 Abs. 4 Satz 2: the working time lost on a holiday on a Werktag, the Soll of the day (S-208);
   * default 8 hours on as many holidays as the five-day week leaves room for (docs/regeln.md, R-15)
   */
  feiertagsausfall?: (tag: Tag) => number;
};

export const MINUTE = 60_000;

/** Whether the person is a Jugendlicher on a day (§ 2 Abs. 2 JArbSchG) */
export const jugendlichAm = (geburtsdatum: Tag, tag: Tag, grenzen: JugendGrenzen): boolean =>
  alterAm(geburtsdatum, tag) < grenzen.volljaehrig;

/**
 * Runs a check on each entry whose day the person is a Jugendlicher on, with the limits in force on
 * it; an entry without a rule version is not judged but named in `nichtHinterlegt`, a day of an
 * adult is left out
 */
export const fuerJugendliche = <E, B>(
  eintraege: readonly E[],
  tagVon: (eintrag: E) => Tag,
  geburtsdatum: Tag,
  pruefe: (eintrag: E, grenzen: JugendGrenzen) => B[],
): { befunde: B[]; nichtHinterlegt: Tag[] } => {
  const befunde: B[] = [];
  const nichtHinterlegt: Tag[] = [];
  for (const eintrag of eintraege) {
    const tag = tagVon(eintrag);
    const grenzen = jugendGrenzenAm(tag);
    if (grenzen === null) nichtHinterlegt.push(tag);
    else if (jugendlichAm(geburtsdatum, tag, grenzen)) befunde.push(...pruefe(eintrag, grenzen));
  }
  return { befunde, nichtHinterlegt: [...new Set(nichtHinterlegt)].sort() };
};

/** The numbers of an exception that are valid: whole numbers from 1 to `hoechstens` */
const gueltig = (nummern: readonly number[], hoechstens: number): number[] =>
  nummern.filter((nummer) => Number.isInteger(nummer) && nummer >= 1 && nummer <= hoechstens);

/** § 16 Abs. 2 JArbSchG: whether a case allows work on Saturdays, set or brought by the industry */
export const samstagErlaubt = (optionen: JugendOptionen, grenzen: JugendGrenzen): boolean =>
  gueltig(optionen.samstag ?? [], grenzen.samstagNummern).length > 0 ||
  grenzen.samstagIn[optionen.branche ?? "andere"] !== undefined;

/** § 17 Abs. 2 JArbSchG: whether a case allows work on Sundays (and holidays, § 18 Abs. 2) */
export const sonntagErlaubt = (optionen: JugendOptionen, grenzen: JugendGrenzen): boolean =>
  gueltig(optionen.sonntag ?? [], grenzen.sonntagNummern).length > 0 ||
  grenzen.sonntagIn[optionen.branche ?? "andere"] !== undefined;
