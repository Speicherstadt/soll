import type { Tag } from "../kalender/tag.ts";
import type { PlanSchicht } from "./typen.ts";

/** A row of the week: a person (null for the shifts nobody is planned for) and a cell per day */
export type RasterZeile<S extends PlanSchicht = PlanSchicht> = {
  nutzerId: string | null;
  zellen: S[][];
};

/**
 * The grid of the week view (DESIGN.md, "Dienstplan"): people as rows in the order given, then
 * anyone else who has a shift in the week (who left since, say), then the open shifts; days as
 * columns. A shift stands on the day it begins on, also over midnight (docs/plan.md, "Schicht und
 * Arbeitstag"); in a cell the shifts follow their beginning.
 */
export const wochenRaster = <S extends PlanSchicht>(
  tage: readonly Tag[],
  nutzerIds: readonly string[],
  schichten: readonly S[],
): RasterZeile<S>[] => {
  const inWoche = schichten
    .filter((schicht) => tage.includes(schicht.tag))
    .sort((a, b) => a.beginn - b.beginn);
  const weitere = inWoche
    .map((schicht) => schicht.nutzerId)
    .filter((id): id is string => id !== null && !nutzerIds.includes(id));
  const zeilen: (string | null)[] = [...new Set([...nutzerIds, ...weitere]), null];
  return zeilen.map((nutzerId) => ({
    nutzerId,
    zellen: tage.map((tag) =>
      inWoche.filter((schicht) => schicht.tag === tag && schicht.nutzerId === nutzerId),
    ),
  }));
};
