import type { Tag } from "../kalender/tag.ts";

/**
 * A planned shift (S-501): instants in UTC milliseconds on whole minutes, `tag` the Berlin day it
 * begins on (CLAUDE.md, "Time"), `nutzerId` null while nobody is planned for it ("offen"). S-502
 * builds a `PruefSchicht` from it, S-503 publishes it, S-504 hands it to another person.
 */
export type PlanSchicht = {
  schichtId: string;
  standortId: string;
  tag: Tag;
  beginn: number;
  ende: number;
  pauseMinuten: number;
  rolle: string;
  nutzerId: string | null;
};

/**
 * A planned Rufbereitschaft (S-505): reachable from `beginn` to `ende` (UTC milliseconds on whole
 * minutes), `tag` the Berlin day it begins on. `reaktionMinuten` is the time the duty allows from
 * the call to the start of work; null while not set, and then, as under 30 minutes, the whole duty
 * counts as working time for the limits (R-12, EuGH C-518/15 Matzak).
 */
export type PlanRufdienst = {
  rufdienstId: string;
  standortId: string;
  tag: Tag;
  beginn: number;
  ende: number;
  reaktionMinuten: number | null;
  nutzerId: string | null;
};

/**
 * A recurring need: `anzahl` people of a role at a site on a weekday (1 Monday to 7 Sunday, ISO
 * 8601), from `beginnMinute` to `endeMinute` on the Berlin clock; an end at or before the beginning
 * lies on the next day
 */
export type Bedarf = {
  bedarfId: string;
  standortId: string;
  rolle: string;
  wochentag: number;
  beginnMinute: number;
  endeMinute: number;
  anzahl: number;
};
