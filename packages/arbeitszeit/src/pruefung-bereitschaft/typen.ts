import type { Stueck } from "../arbeitstag/schichten.ts";
import type { Tag } from "../kalender/tag.ts";
import type { PruefSchicht } from "../pruefung/typen.ts";

/** A span of time in UTC milliseconds, end after start */
export type Spanne = { beginn: number; ende: number };

/**
 * Rufbereitschaft (R-12): reachable, free to choose where to be. `reaktionMinuten` is the time the
 * duty allows from the call to the start of work (setting at the duty); under the limit of the rule
 * version, and while it is not set, the whole duty counts as working time (EuGH C-518/15, Matzak).
 */
export type Rufdienst = Spanne & { reaktionMinuten?: number };

/**
 * What S-206 adds to the working days: Bereitschaftsdienst and Arbeitsbereitschaft at the place the
 * business decides (R-11), the duties of Rufbereitschaft and their call-outs (R-12), each a call-out
 * from the call to the end of work, the way there and back included. A planned duty (S-505) and a
 * recorded one come in the same shape.
 */
export type BereitschaftEingabe = {
  bereitschaftsdienste?: readonly Spanne[];
  rufdienste?: readonly Rufdienst[];
  einsaetze?: readonly Spanne[];
};

/**
 * A shift in the shape of §§ 3 to 5 ArbZG (`PruefSchicht`) with what S-206 marks in it:
 * `bereitschaft`, the stretches of Bereitschaftsdienst (and of Rufbereitschaft counted fully), which
 * are working time like any other (EuGH C-151/02, Jaeger); `einsaetze`, the blocks that are only
 * call-outs, whose end begins a rest and whose start ends none (R-12).
 */
export type BereitschaftsSchicht = PruefSchicht & {
  bereitschaft: readonly Stueck[];
  einsaetze: readonly Stueck[];
};

/**
 * A working day (`PruefTag`) with Bereitschaft: every rule of Phase 2 reads it as it reads a day of
 * S-201. The minutes are those of the closed shifts: all working time, the part of it that is
 * Bereitschaftsdienst, and the part that is call-outs.
 */
export type BereitschaftsTag = {
  tag: Tag;
  schichten: readonly BereitschaftsSchicht[];
  arbeitsMinuten: number;
  bereitschaftsMinuten: number;
  einsatzMinuten: number;
};
