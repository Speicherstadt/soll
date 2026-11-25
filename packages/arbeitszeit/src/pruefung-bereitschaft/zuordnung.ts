import type { Befund } from "../befund.ts";
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

/**
 * Findings on the joined shifts of `bereitschaftstage` that also name the working days the stamps
 * give the work in them (review of S-505): a call-out on 31.10. joined to work stamped on 1.11. is
 * one shift of 31.10. for the rules, but its finding concerns November as well, and must not vanish
 * once October is closed
 */
export const mitStempeltagen = <B extends Befund>(
  befunde: readonly B[],
  gestempelt: readonly PruefTag[],
  verbunden: readonly PruefTag[],
): B[] => {
  const auch = new Map<Tag, Tag[]>();
  for (const tag of gestempelt)
    for (const schicht of tag.schichten) {
      const neu = arbeitstagMit(verbunden, schicht.beginn);
      if (neu !== null && neu !== tag.tag) auch.set(neu, [...(auch.get(neu) ?? []), tag.tag]);
    }
  if (auch.size === 0) return [...befunde];
  return befunde.map((befund) => {
    const dazu = befund.tage.flatMap((tag) => auch.get(tag) ?? []);
    return dazu.length === 0
      ? befund
      : { ...befund, tage: [...new Set([...befund.tage, ...dazu])].sort() };
  });
};
