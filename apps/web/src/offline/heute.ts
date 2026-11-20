import { aktuellerTag, stempelungenAm } from "@soll/arbeitszeit";
import type { Stempel, TagAnsicht } from "../zeiten/typen.ts";

const nachZeit = (a: Stempel, b: Stempel) => a.zeitpunkt - b.zeitpunkt;

/**
 * One's own running day with the stamps still waiting in the device's queue (S-305): the running day
 * is found again with them (a Kommen after midnight starts a new one), and the stamps of that day are
 * taken as the server takes them (`aktuellerTag`, `stempelungenAm`). Without waiting stamps the day
 * stays as the server sent it. The target belongs to the day it was loaded for.
 */
export const mitWartenden = (
  ansicht: TagAnsicht,
  wartende: readonly Stempel[],
  jetzt: number,
): TagAnsicht => {
  if (wartende.length === 0) return ansicht;
  const umfeld = [...ansicht.umfeld, ...wartende].sort(nachZeit);
  const nun = Math.max(jetzt, ...wartende.map((stempel) => stempel.zeitpunkt));
  const tag = aktuellerTag(
    umfeld.filter((stempel) => stempel.zeitpunkt <= nun),
    nun,
  );
  return {
    ...ansicht,
    tag,
    jetzt: nun,
    sollMinuten: tag === ansicht.tag ? ansicht.sollMinuten : null,
    umfeld,
    stempelungen: stempelungenAm(umfeld, nun, tag),
  };
};
