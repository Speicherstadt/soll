import type { Tag } from "../kalender/tag.ts";
import type { PruefTag } from "../pruefung/typen.ts";

/**
 * The working day whose shift holds an instant, or null when no shift does: a call-out or a stretch
 * of planned work belongs to the day of the shift it was cut into (Grundbegriff „Schicht“, R-12),
 * which may be the day before the one it begins on. An open shift holds everything after its start.
 */
export const arbeitstagMit = (tage: readonly PruefTag[], zeitpunkt: number): Tag | null => {
  for (const tag of tage) {
    for (const schicht of tag.schichten) {
      if (schicht.beginn <= zeitpunkt && (schicht.ende === null || zeitpunkt < schicht.ende))
        return tag.tag;
    }
  }
  return null;
};
