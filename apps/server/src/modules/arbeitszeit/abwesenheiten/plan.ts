import type { Tag } from "@soll/arbeitszeit";

/**
 * The interface between absences and the shift plan (S-401 for S-501). Soll has no plan yet: a
 * request shows the person's own shifts in its span, and a sickness reports its planned shifts as
 * open, both through this source. The plan module passes its own source to `createApp`; until then
 * there are none (`ohnePlan`). The plan in turn asks `abwesenheitenIn` (lesen.ts) which approved
 * absences fall on a day, and shows each only as „abwesend“, like the team calendar.
 */
export type GeplanteSchicht = {
  schichtId: string;
  nutzerId: string;
  /** the working day: the day the shift begins (CLAUDE.md, "Time") */
  tag: Tag;
  beginn: number;
  ende: number;
  /** what the plan calls it, e.g. „Frühschicht“ */
  bezeichnung: string;
};

/** The planned shifts of a person on the days from `von` to `bis`, both included */
export type Schichtquelle = (
  betriebId: string,
  nutzerId: string,
  von: Tag,
  bis: Tag,
) => GeplanteSchicht[];

export const ohnePlan: Schichtquelle = () => [];
