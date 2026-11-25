import { plusTage } from "@soll/arbeitszeit";
import type { ImportZeit, LeseFehler } from "./modell.ts";
import type { BerlinerUhr } from "./uhr.ts";

/*
 * Spans of work from tools that keep instants (Clockodo S-703, Kimai S-705, Personio S-704): the
 * pieces of a person that touch or overlap become one block, each block one span with Kommen and
 * Gehen and no break of its own; the gaps between blocks are the breaks as they were taken.
 */

export const MINUTE = 60_000;
const TAG = 24 * 60 * MINUTE;

/** A block of work: instants on whole minutes, named by the id and line of its first piece */
export type Spanne = { zeile: number; id: string; beginn: number; ende: number };

/**
 * The blocks of one person's pieces: sorted by `folge`, touching or overlapping ones merged into
 * the first (its id and line name the block)
 */
export const zusammenfassen = <T extends Spanne>(
  stuecke: readonly T[],
  folge: (a: T, b: T) => number,
): T[] => {
  const ergebnis: T[] = [];
  for (const stueck of [...stuecke].sort(folge)) {
    const letzter = ergebnis.at(-1);
    if (letzter && stueck.beginn <= letzter.ende)
      letzter.ende = Math.max(letzter.ende, stueck.ende);
    else ergebnis.push({ ...stueck });
  }
  return ergebnis;
};

/**
 * A block as a span on Berlin's clock, or why a day and two times cannot name it (`felder` names
 * the tool's fields of begin and end). The planner rebuilds the instants from the day and the two
 * times, an end at or before the begin on the next day (plan-zeiten.ts); a block whose end falls on
 * another day than that rebuilds to another span (across the change to summer time, 23 h 30 min
 * would become 30 min: review S-703), so it is refused rather than shortened. Two instants that are
 * neither in the hour that comes twice nor on the wrong day come back exactly: an instant never lies
 * in the hour the clocks skip.
 */
export const spanneAlsZeit = (
  spanne: Spanne,
  person: string,
  uhr: BerlinerUhr,
  felder: { beginn: string; ende: string },
): ImportZeit | LeseFehler => {
  const { zeile } = spanne;
  if (spanne.ende - spanne.beginn >= TAG)
    return { zeile, grund: "zeit_ungueltig", feld: felder.ende };
  if (uhr.doppelt(spanne.beginn)) return { zeile, grund: "zeit_ungueltig", feld: felder.beginn };
  if (uhr.doppelt(spanne.ende)) return { zeile, grund: "zeit_ungueltig", feld: felder.ende };
  const beginn = uhr.uhr(spanne.beginn);
  const ende = uhr.uhr(spanne.ende);
  const endeTag = ende.minute > beginn.minute ? beginn.tag : plusTage(beginn.tag, 1);
  if (ende.tag !== endeTag) return { zeile, grund: "zeit_ungueltig", feld: felder.ende };
  return {
    externalId: spanne.id,
    zeile,
    person,
    tag: beginn.tag,
    beginn: beginn.minute,
    ende: ende.minute,
    pauseMinuten: 0,
  };
};
