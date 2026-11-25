import { arbeitstage } from "../arbeitstag/arbeitstag.ts";
import type { Stempelart } from "../arbeitstag/stempelungen.ts";
import type { Tag } from "../kalender/tag.ts";

/*
 * The values of the days of a month's records, for the time sheet, the Prüfexport and the month in
 * the app (S-505): one function, so all of them show the Ist of a day with call-outs.
 */

/** A day of a month's records: its stamps and its call-outs (apps/server, monatsinhalt.ts) */
export type Inhaltstag = {
  tag: Tag;
  stempel: readonly (readonly [Stempelart, number])[];
  einsaetze?: readonly (readonly [number, number | null])[];
};

/** Beginning, end, break and work of a day as the time sheet and the Prüfexport show it */
export type Tageswerte = {
  beginn: number | null;
  ende: number | null;
  pauseMinuten: number;
  arbeitsMinuten: number;
};

/**
 * The values of each day of a month's records, read from its stamps and call-outs up to `bis`: the
 * call-outs as the same times stamped (R-12, R-29), so every day shows the Ist
 */
export const tageswerteDesInhalts = (
  aufzeichnung: readonly Inhaltstag[],
  bis: number,
): ((tag: Inhaltstag) => Tageswerte) => {
  const ergebnis = arbeitstage(
    aufzeichnung.flatMap((tag) => tag.stempel.map(([art, zeitpunkt]) => ({ art, zeitpunkt }))),
    bis,
    aufzeichnung.flatMap((tag) =>
      (tag.einsaetze ?? []).map(([beginn, ende]) => ({ beginn, ende })),
    ),
  );
  const nachTag = new Map((ergebnis.ok ? ergebnis.wert : []).map((tag) => [tag.tag, tag]));
  return (auf) => {
    const tag = nachTag.get(auf.tag);
    return {
      beginn: tag?.beginn ?? null,
      ende: tag?.ende ?? null,
      pauseMinuten: tag?.pausenMinuten ?? 0,
      arbeitsMinuten: tag?.arbeitsMinuten ?? 0,
    };
  };
};
