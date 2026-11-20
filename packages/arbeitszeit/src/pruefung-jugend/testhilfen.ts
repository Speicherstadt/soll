import { plusTage, type Tag } from "../kalender/tag.ts";
import type { PruefTag } from "../pruefung/typen.ts";
import { HAMBURG, tagAb } from "../pruefung-nacht-sonntag/testhilfen.ts";
import type { JugendOptionen } from "./typen.ts";

export { gehen, kommen, pause, schicht, tage, um, weiter } from "../pruefung/testhilfen.ts";
/*
 * Helpers for the tests of the JArbSchG. Leon, apprentice at Weber Haustechnik (SHK, Hamburg), is 17
 * throughout 2026 (CLAUDE.md, test data); single cases go through the stamps of S-201, weeks are
 * built as working days directly.
 */
export { HAMBURG, tagAb } from "../pruefung-nacht-sonntag/testhilfen.ts";

/** Leon turns 18 on 10 March 2027 */
export const LEON: JugendOptionen = { geburtsdatum: "2009-03-10", standort: HAMBURG };
/** A 17-year-old in the Café Elbblick (Gaststättengewerbe, Hamburg) without Berufsschule */
export const CAFE: JugendOptionen = {
  ...LEON,
  branche: "gaststaetten",
  berufsschuleVor9: new Set(),
};

/** Mo 16.11.2026, a week without holidays in Hamburg */
export const MONTAG: Tag = "2026-11-16";

/** "8:30" as minutes */
export const h = (text: string): number => {
  const [stunden = 0, minuten = 0] = text.split(":").map(Number);
  return stunden * 60 + minuten;
};

/** One shift from 7:00 a day from `montag` on, `dauern[i]` long ("8:30"; "" for a day off) */
export const woche = (montag: Tag, dauern: readonly string[]): PruefTag[] =>
  dauern.flatMap((dauer, versatz) =>
    dauer === "" ? [] : [tagAb(plusTage(montag, versatz), "7:00", h(dauer))],
  );

/** Berlin wall-clock time with the offset of winter time */
export const mez = (tag: Tag, uhr: string) => `${tag}T${uhr.padStart(5, "0")}+01:00`;
