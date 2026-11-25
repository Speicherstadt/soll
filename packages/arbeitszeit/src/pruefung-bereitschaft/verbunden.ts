import type { Tag } from "../kalender/tag.ts";
import { tagInBerlin } from "../kalender/zeit.ts";
import { arbeitsMinutenAm, type PruefTag } from "../pruefung/typen.ts";
import { bereitschaftstage } from "./bereitschaftstage.ts";
import { arbeitstagMit } from "./zuordnung.ts";

/*
 * The working days with the call-outs from a Rufbereitschaft, as the record of times, the Ist,
 * payroll and the rules all read them (R-12, reviews of S-505). A call-out joins the shift it
 * belongs to by the Grundbegriff „Schicht“ (`bereitschaftstage`): after other work within 9 hours,
 * before it within 15 minutes; the joined shift belongs to the day it begins on, as the same times
 * stamped would (CLAUDE.md, "Time"), its stamps included, and what is stamped at the same time
 * counts once. One assignment for all of them, so records, lock, Ist and payroll never disagree.
 */

/** A call-out from the call to the end of work; `ende` null while it runs */
export type Einsatzspanne = { beginn: number; ende: number | null };

/** A working day with its minutes: of the closed shifts, joined call-outs included */
export type VerbundenerTag = PruefTag & { arbeitsMinuten: number };

export type MitEinsaetzen = {
  /** the working days in calendar order */
  tage: VerbundenerTag[];
  /**
   * the working day of the shift that holds an instant: of a stamp's shift (pass its start) or a
   * call-out's beginning; null for an instant in no shift (a running call-out on its own)
   */
  tagVon: (zeitpunkt: number) => Tag | null;
};

const mitMinuten = (tage: readonly PruefTag[]): VerbundenerTag[] =>
  tage.map((tag) => ({ ...tag, arbeitsMinuten: arbeitsMinutenAm(tag) }));

/**
 * The stamped working days with the call-outs that ended joined in; a running call-out joins
 * nothing until it ends (R-01). Without call-outs the stamped days stay as they are.
 */
export const mitEinsaetzen = (
  gestempelt: readonly PruefTag[],
  einsaetze: readonly Einsatzspanne[],
): MitEinsaetzen => {
  const geschlossen = einsaetze.flatMap(({ beginn, ende }) =>
    ende === null ? [] : [{ beginn, ende }],
  );
  const ergebnis =
    geschlossen.length > 0 ? bereitschaftstage(gestempelt, { einsaetze: geschlossen }) : null;
  const tage = ergebnis?.ok ? ergebnis.wert : mitMinuten(gestempelt);
  return { tage, tagVon: (zeitpunkt) => arbeitstagMit(tage, zeitpunkt) };
};

/** The working day of a call-out: of the shift it lies in, else the Berlin day it begins on */
export const einsatzTag = (verbunden: MitEinsaetzen, einsatz: Einsatzspanne): Tag =>
  verbunden.tagVon(einsatz.beginn) ?? tagInBerlin(einsatz.beginn);
