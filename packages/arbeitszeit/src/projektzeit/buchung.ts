import { arbeitstage } from "../arbeitstag/arbeitstag.ts";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import type { Tag } from "../kalender/tag.ts";
import { tagInBerlin } from "../kalender/zeit.ts";

/**
 * Bookings of project time (BAULISTE.md S-602, docs/projektzeit.md): instants on whole minutes,
 * the working day a booking falls in, and the hint when a day has more project time than stamped
 * working time. Pure functions; durations in whole minutes (CLAUDE.md, "Never").
 */

const MINUTE = 60_000;

/** A booking's span; `ende` null while the stopwatch runs */
export type BuchungsSpanne = { beginn: number; ende: number | null };

/** An instant taken to the start of its minute: a booking's begin and end are whole minutes */
export const aufMinute = (ms: number): number => Math.floor(ms / MINUTE) * MINUTE;

/**
 * The whole minutes of a booking from UTC instants, so the night of a change of time counts its real
 * minutes; a running booking counts up to `jetzt`
 */
export const buchungsMinuten = (beginn: number, ende: number | null, jetzt = beginn): number =>
  Math.max(0, Math.floor(((ende ?? jetzt) - beginn) / MINUTE));

/** Whether two bookings share a minute; touching (one ends when the next begins) is no overlap */
export const ueberschneiden = (a: BuchungsSpanne, b: BuchungsSpanne): boolean =>
  a.beginn < (b.ende ?? Number.POSITIVE_INFINITY) &&
  b.beginn < (a.ende ?? Number.POSITIVE_INFINITY);

export type Zuordnung<S> = { tag: Tag; kommen: S | null };

/**
 * The working day of a booking that begins at `beginn`: the day of the shift it falls in (a night
 * shift's day after midnight too, CLAUDE.md "Time"), with that shift's Kommen as the reference to
 * the stamps; outside every shift the Berlin day of its begin and no Kommen.
 */
export const buchungZuordnen = <S extends Stempelung>(
  stempelungen: readonly S[],
  jetzt: number,
  beginn: number,
): Zuordnung<S> => {
  const ergebnis = arbeitstage(stempelungen, jetzt);
  const schichten = ergebnis.ok ? ergebnis.wert.flatMap((eintrag) => eintrag.schichten) : [];
  // a closed shift ends with its Gehen; one that still runs reaches up to now, now included
  const schicht = schichten.find(
    (kandidat) =>
      beginn >= kandidat.beginn &&
      (kandidat.ende === null ? beginn <= jetzt : beginn < kandidat.ende),
  );
  if (!schicht) return { tag: tagInBerlin(beginn), kommen: null };
  const kommen = stempelungen.find(
    (stempel) => stempel.art === "kommen" && stempel.zeitpunkt === schicht.beginn,
  );
  return { tag: schicht.tag, kommen: kommen ?? null };
};

/** More project time on a working day than stamped working time: a hint, with both sums */
export type ProjektzeitHinweis = {
  art: "mehr_projektzeit";
  schwere: "hinweis";
  gebuchtMinuten: number;
  gestempeltMinuten: number;
  ueberMinuten: number;
};

/**
 * The hint for a working day: project time is part of the working time, so more of it than was
 * stamped means a booking or a stamp is wrong. Nothing is changed or judged; the day only says so.
 */
export const projektzeitHinweis = (tag: {
  gebuchtMinuten: number;
  gestempeltMinuten: number;
}): ProjektzeitHinweis | null =>
  tag.gebuchtMinuten > tag.gestempeltMinuten
    ? {
        art: "mehr_projektzeit",
        schwere: "hinweis",
        gebuchtMinuten: tag.gebuchtMinuten,
        gestempeltMinuten: tag.gestempeltMinuten,
        ueberMinuten: tag.gebuchtMinuten - tag.gestempeltMinuten,
      }
    : null;
