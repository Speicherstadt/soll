import type { Standort } from "../feiertage/laender.ts";
import { alterAm } from "../kalender/alter.ts";
import type { Tag } from "../kalender/tag.ts";
import type { Sonntagsausnahme } from "../pruefung-nacht-sonntag/sonntagsruhe.ts";
import { type MutterschutzGrenzen, mutterschutzGrenzenAm } from "./grenzen.ts";
import type { Schutzfrist } from "./schutzfristen.ts";

/*
 * Shapes and helpers of the checks of the MuSchG on top of the working days of S-202
 * (pruefung/typen.ts): the same `PruefTag`, the same `Pruefergebnis`.
 */
export {
  arbeitsMinutenAm,
  geschlossen,
  nachTag,
  type Pruefergebnis,
  type PruefTag,
  sortiert,
} from "../pruefung/typen.ts";

/** Days from `von` to `bis`, both included; `bis` null while it lasts */
export type Tagesspanne = { von: Tag; bis: Tag | null };

/**
 * What the checks of the MuSchG need besides the working days. A pregnancy is a health fact (Art. 9
 * DSGVO): the rules take the span the mark on the employee holds, without saying whether she is
 * pregnant or breastfeeding, and the other dates only where a rule needs them (docs/regeln.md, R-21).
 * Everything not entered counts as not given, never as allowed.
 */
export type MutterschutzOptionen = {
  /** the spans in which the person is pregnant or breastfeeding */
  zeitraeume: readonly Tagesspanne[];
  /** § 4 Abs. 1 Satz 2: unknown, the limits for women under 18 apply */
  geburtsdatum?: Tag | null;
  /**
   * § 4 Abs. 1 Satz 4: the contractual weekly working time in minutes on a day, from the
   * Arbeitszeitmodell; without it, the month is "nicht hinterlegt"
   */
  wochenarbeitszeitAm?: (tag: Tag) => number | null;
  /** the place of work: its Land and regions decide the holidays (S-105) */
  standort: Standort;
  /** decides whether a week for the Ersatzruhetag of § 6 Abs. 1 Satz 2 Nr. 3 has passed */
  jetzt: number;
  /** § 5 Abs. 1 Satz 2, § 28: a permit to work until 22 Uhr, for the days it names or every day */
  genehmigung28?: { fundstelle: string; tage?: ReadonlySet<Tag> };
  /** § 6 Abs. 1 Satz 2 Nr. 1: the spans of her express declaration to work on Sundays and holidays */
  sonntagsbereitschaft?: readonly Tagesspanne[];
  /** § 6 Abs. 1 Satz 2 Nr. 2: the exceptions of the business under § 10 ArbZG (R-07) */
  ausnahmen?: readonly Sonntagsausnahme[];
  /** § 3: the Schutzfristen entered, with their dates */
  schutzfristen?: readonly Schutzfrist[];
};

export const MINUTE = 60_000;

export const inSpanne = (spannen: readonly Tagesspanne[], tag: Tag): boolean =>
  spannen.some((spanne) => spanne.von <= tag && (spanne.bis === null || tag <= spanne.bis));

/** § 4 Abs. 1 Satz 2: under 18 on a day, or without a known birth date */
export const minderjaehrig = (
  geburtsdatum: Tag | null | undefined,
  tag: Tag,
  grenzen: MutterschutzGrenzen,
): boolean => geburtsdatum == null || alterAm(geburtsdatum, tag) < grenzen.volljaehrig;

/**
 * Runs a check on each entry whose day lies in a span of the mark, with the limits in force on it;
 * an entry without a rule version is not judged but named in `nichtHinterlegt`
 */
export const fuerGeschuetzte = <E, B>(
  eintraege: readonly E[],
  tagVon: (eintrag: E) => Tag,
  zeitraeume: readonly Tagesspanne[],
  pruefe: (eintrag: E, grenzen: MutterschutzGrenzen) => B[],
): { befunde: B[]; nichtHinterlegt: Tag[] } => {
  const befunde: B[] = [];
  const nichtHinterlegt: Tag[] = [];
  for (const eintrag of eintraege) {
    const tag = tagVon(eintrag);
    if (!inSpanne(zeitraeume, tag)) continue;
    const grenzen = mutterschutzGrenzenAm(tag);
    if (grenzen === null) nichtHinterlegt.push(tag);
    else befunde.push(...pruefe(eintrag, grenzen));
  }
  return { befunde, nichtHinterlegt: [...new Set(nichtHinterlegt)].sort() };
};
