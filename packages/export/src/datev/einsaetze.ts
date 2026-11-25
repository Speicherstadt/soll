import { bereitschaftstage, type PruefTag, type Tag, zusatzMinutenJeTag } from "@soll/arbeitszeit";

/*
 * The call-outs of a closed month as payroll reads them (S-505, reviews): never less than if the
 * same times had been stamped (R-29). Hours: stamped work keeps its day and model, a call-out adds
 * its own minutes on the day of its record and a gap under 15 minutes to other work counts as in a
 * stamped shift (`zusatzMinutenJeTag`). Surcharges: over the joined shift of `bereitschaftstage`, as
 * the rules read it, so a call-out after midnight that continues a shift begun before it gets the
 * 40 % from 0 to 4 Uhr (§ 3b Abs. 3 Nr. 1 EStG), and per-day rounding is that of the stamped shift.
 */

/** A working day as payroll reads it: its shifts and the minutes worked */
export type Lohntag = PruefTag & { arbeitsMinuten: number };

type Aufzeichnung = { tag: Tag; einsaetze?: readonly (readonly [number, number | null])[] };

const einsaetzeVon = (aufzeichnung: readonly Aufzeichnung[]) =>
  aufzeichnung
    .flatMap((tag) =>
      (tag.einsaetze ?? []).map(([beginn, ende]) => ({ tag: tag.tag, beginn, ende })),
    )
    .sort((a, b) => a.beginn - b.beginn);

/** The days for the hours: the stamped days with the minutes the call-outs add, by the record's day */
export const stundentage = (
  gestempelt: readonly Lohntag[],
  aufzeichnung: readonly Aufzeichnung[],
): Lohntag[] => {
  const zusatz = zusatzMinutenJeTag(gestempelt, einsaetzeVon(aufzeichnung));
  const jeTag = new Map<Tag, Lohntag>(gestempelt.map((tag) => [tag.tag, tag]));
  for (const [tag, minuten] of zusatz) {
    const vorher = jeTag.get(tag);
    jeTag.set(tag, {
      tag,
      schichten: vorher?.schichten ?? [],
      arbeitsMinuten: (vorher?.arbeitsMinuten ?? 0) + minuten,
    });
  }
  return [...jeTag.values()].sort((a, b) => a.tag.localeCompare(b.tag));
};

/** The days for the surcharges: the stamped shifts joined with the call-outs that ended (R-12) */
export const zuschlagstage = (
  gestempelt: readonly Lohntag[],
  aufzeichnung: readonly Aufzeichnung[],
): Lohntag[] => {
  const einsaetze = einsaetzeVon(aufzeichnung).flatMap(({ beginn, ende }) =>
    ende === null ? [] : [{ beginn, ende }],
  );
  if (einsaetze.length === 0) return [...gestempelt];
  const verbunden = bereitschaftstage(gestempelt, { einsaetze });
  if (!verbunden.ok) throw new Error("lohnmonat: call-outs of a closed month are invalid");
  return verbunden.wert;
};
