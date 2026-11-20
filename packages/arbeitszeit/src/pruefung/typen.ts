import type { Schicht } from "../arbeitstag/schichten.ts";
import type { Befund } from "../befund.ts";
import type { Tag } from "../kalender/tag.ts";
import { type ArbzgGrenzen, arbzgGrenzenAm } from "./grenzen.ts";

/**
 * What the rules of §§ 3 to 5 ArbZG read from a shift. A shift built from stamps (S-201) has this
 * shape; a planned shift (S-502) is built in the same shape, so one check serves both.
 */
export type PruefSchicht = Pick<
  Schicht,
  "tag" | "beginn" | "ende" | "pausen" | "bloecke" | "arbeitsMinuten"
>;

/** A working day: its Berlin calendar day and the shifts that begin on it, in order */
export type PruefTag = { tag: Tag; schichten: readonly PruefSchicht[] };

/**
 * The findings of a rule, and the days it could not judge because no rule version is in force on
 * them (before 1.1.2026): Soll does not apply the limits of another version (CLAUDE.md, "Never").
 */
export type Pruefergebnis<B extends Befund = Befund> = { befunde: B[]; nichtHinterlegt: Tag[] };

/**
 * The shifts a rule judges: closed ones. An open shift is a finding of R-01 until its Gehen is
 * stamped; its time so far is not complete, so it is judged once it is.
 */
export const geschlossen = (tag: PruefTag): PruefSchicht[] =>
  tag.schichten.filter((schicht) => schicht.ende !== null);

export const arbeitsMinutenAm = (tag: PruefTag): number =>
  geschlossen(tag).reduce((summe, schicht) => summe + schicht.arbeitsMinuten, 0);

/** Days in calendar order, each once */
export const sortiert = (tage: Iterable<Tag>): Tag[] => [...new Set(tage)].sort();

/** Findings in calendar order of their first day; sort is stable, so a rule's own order stays */
export const nachTag = <B extends Befund>(befunde: readonly B[]): B[] =>
  [...befunde].sort((a, b) => (a.tage[0] ?? "").localeCompare(b.tage[0] ?? ""));

/**
 * Runs a check on each entry with the limits in force on its day; an entry whose day has no rule
 * version is not judged but named in `nichtHinterlegt`
 */
export const mitGrenzen = <E, B extends Befund>(
  eintraege: readonly E[],
  tagVon: (eintrag: E) => Tag,
  pruefe: (eintrag: E, grenzen: ArbzgGrenzen) => B[],
): Pruefergebnis<B> => {
  const befunde: B[] = [];
  const nichtHinterlegt: Tag[] = [];
  for (const eintrag of eintraege) {
    const grenzen = arbzgGrenzenAm(tagVon(eintrag));
    if (grenzen === null) nichtHinterlegt.push(tagVon(eintrag));
    else befunde.push(...pruefe(eintrag, grenzen));
  }
  return { befunde, nichtHinterlegt: sortiert(nichtHinterlegt) };
};
