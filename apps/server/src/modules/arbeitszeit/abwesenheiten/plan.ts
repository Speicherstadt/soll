import type { Tag } from "@soll/arbeitszeit";

/**
 * The interface between absences and the shift plan (S-401, S-501): a request shows the person's
 * own shifts in its span, and a sickness reports its planned shifts as open, both through this
 * source. The module Dienstplan provides it (`schichtquelle` in its index.ts) and answers nothing
 * while the business has it switched off. Drafts are not yet planned for the person, but whoever
 * plans needs to know them too (docs/plan.md, "Abwesenheit und Dienstplan").
 */
export type GeplanteSchicht = {
  schichtId: string;
  nutzerId: string;
  /** the working day: the day the shift begins (CLAUDE.md, "Time") */
  tag: Tag;
  beginn: number;
  ende: number;
  /** what the plan calls it: the template's name, else the role, else its times */
  bezeichnung: string;
  /** not yet published (S-503): only whoever plans hears of it */
  entwurf: boolean;
};

/** The planned shifts of a person on the days from `von` to `bis`, both included */
export type Schichtquelle = (
  betriebId: string,
  nutzerId: string,
  von: Tag,
  bis: Tag,
  mitEntwurf: boolean,
) => GeplanteSchicht[];
