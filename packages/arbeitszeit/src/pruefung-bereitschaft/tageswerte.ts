import { arbeitstage } from "../arbeitstag/arbeitstag.ts";
import type { Stempelart } from "../arbeitstag/stempelungen.ts";
import type { Tag } from "../kalender/tag.ts";
import { mitEinsaetzen } from "./verbunden.ts";

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
 * The values of each day of a month's records, read from its stamps up to `bis`: a day with
 * call-outs from its joined shift (R-12), so its work is the Ist, what is stamped at the same time
 * once and a gap under 15 minutes as working time (reviews of S-505); any other day from its stamps
 */
export const tageswerteDesInhalts = (
  aufzeichnung: readonly Inhaltstag[],
  bis: number,
): ((tag: Inhaltstag) => Tageswerte) => {
  const ergebnis = arbeitstage(
    aufzeichnung.flatMap((tag) => tag.stempel.map(([art, zeitpunkt]) => ({ art, zeitpunkt }))),
    bis,
  );
  const gestempelt = ergebnis.ok ? ergebnis.wert : [];
  const nachTag = new Map(gestempelt.map((tag) => [tag.tag, tag]));
  const verbunden = new Map(
    mitEinsaetzen(
      gestempelt,
      aufzeichnung.flatMap((tag) =>
        (tag.einsaetze ?? []).map(([beginn, ende]) => ({ beginn, ende })),
      ),
    ).tage.map((tag) => [tag.tag, tag]),
  );
  return (auf) => {
    const tag = nachTag.get(auf.tag);
    if ((auf.einsaetze ?? []).length === 0)
      return {
        beginn: tag?.beginn ?? null,
        ende: tag?.ende ?? null,
        pauseMinuten: tag?.pausenMinuten ?? 0,
        arbeitsMinuten: tag?.arbeitsMinuten ?? 0,
      };
    const schichten = verbunden.get(auf.tag)?.schichten ?? [];
    return {
      beginn: schichten[0]?.beginn ?? null,
      ende: schichten.at(-1)?.ende ?? null,
      pauseMinuten: schichten
        .flatMap((schicht) => schicht.pausen)
        .filter((pause) => pause.ruhepause)
        .reduce((summe, pause) => summe + pause.minuten, 0),
      arbeitsMinuten: verbunden.get(auf.tag)?.arbeitsMinuten ?? 0,
    };
  };
};
