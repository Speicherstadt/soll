import { einsatzAnteile, type PruefSchicht, type PruefTag, type Tag } from "@soll/arbeitszeit";

/*
 * The call-outs of a closed month as payroll reads them (S-505, review): split from stamped work as
 * the Ist and the time sheet split them (`einsatzAnteile`), so a call-out never moves stamped work
 * to its day or model and what is stamped at the same time counts once
 */

const MINUTE = 60_000;

/** A working day as payroll reads it: its shifts and the minutes worked */
export type Lohntag = PruefTag & { arbeitsMinuten: number };

type Aufzeichnung = { tag: Tag; einsaetze?: readonly (readonly [number, number | null])[] };

/** The counted stretches of one call-out as a shift of its own, for hours and surcharges */
const alsSchicht = (tag: Tag, teile: readonly { beginn: number; ende: number }[]): PruefSchicht => {
  const bloecke = teile.map(({ beginn, ende }) => ({
    beginn,
    ende,
    minuten: (ende - beginn) / MINUTE,
  }));
  return {
    tag,
    beginn: bloecke[0]?.beginn ?? 0,
    ende: bloecke.at(-1)?.ende ?? 0,
    pausen: [],
    bloecke,
    arbeitsMinuten: bloecke.reduce((summe, block) => summe + block.minuten, 0),
  };
};

/**
 * The stamped working days with the call-outs of the records added, each on the day its record
 * names, as shifts of their own of only the minutes not stamped at the same time
 */
export const mitEinsaetzen = (
  gestempelt: readonly Lohntag[],
  aufzeichnung: readonly Aufzeichnung[],
): Lohntag[] => {
  const liste = aufzeichnung
    .flatMap((tag) =>
      (tag.einsaetze ?? []).map(([beginn, ende]) => ({ tag: tag.tag, beginn, ende })),
    )
    .sort((a, b) => a.beginn - b.beginn);
  const anteile = einsatzAnteile(gestempelt, liste);
  const jeTag = new Map(gestempelt.map((tag) => [tag.tag, tag]));
  liste.forEach(({ tag }, index) => {
    const teile = anteile[index]?.teile ?? [];
    if (teile.length === 0) return;
    const schicht = alsSchicht(tag, teile);
    const vorher = jeTag.get(tag);
    jeTag.set(tag, {
      tag,
      schichten: [...(vorher?.schichten ?? []), schicht].sort((a, b) => a.beginn - b.beginn),
      arbeitsMinuten: (vorher?.arbeitsMinuten ?? 0) + schicht.arbeitsMinuten,
    });
  });
  return [...jeTag.values()].sort((a, b) => a.tag.localeCompare(b.tag));
};
