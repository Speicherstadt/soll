import type { ImportZeit, Zuordnung } from "@soll/import";
import type { NeueBuchung, NeueStempelung, PlanGrund, Stand } from "./plan-typen.ts";

/*
 * Bookings of project time from the project and the activity of a time in a spreadsheet (BAULISTE.md
 * S-702): one booking for each piece of work of the time, before and after the break in the middle
 * (the stamps of plan-zeiten.ts), on the order and activity the owner mapped the file's words to.
 * A time without a project and an activity has none; the time itself is taken over either way.
 */

/** The ids of a time's bookings in Soll: "<id>/buchung/1" and, after a break, "/buchung/2" */
export const buchungKennung = (externalId: string, stueck: number): string =>
  `${externalId}/buchung/${stueck}`;

/** What becomes of the bookings of one time */
export type Buchungsergebnis =
  | { art: "keine" }
  | { art: "ausgelassen" }
  | { art: "abgelehnt"; grund: PlanGrund }
  | { art: "neu"; buchungen: NeueBuchung[] };

/** The order and activity of a time, or null when the owner left either out */
const bezugVon = (zeit: ImportZeit, zuordnung: Zuordnung) => {
  const buchung = zuordnung.buchung ?? { projekte: {}, taetigkeiten: {} };
  const projektId = zeit.projekt === undefined ? null : (buchung.projekte[zeit.projekt] ?? null);
  const taetigkeitId = buchung.taetigkeiten[zeit.taetigkeit ?? ""] ?? null;
  if ((zeit.projekt !== undefined && projektId === null) || taetigkeitId === null) return null;
  return { projektId, taetigkeitId };
};

/** The pieces of work of a time's stamps: Kommen to Pause-Beginn and Pause-Ende to Gehen */
const stueckeVon = (stempel: readonly NeueStempelung[]) => {
  const zeitpunkt = (art: NeueStempelung["art"]) => stempel.find((s) => s.art === art)?.zeitpunkt;
  const kommen = zeitpunkt("kommen") as number;
  const gehen = zeitpunkt("gehen") as number;
  const pauseBeginn = zeitpunkt("pause_beginn");
  const pauseEnde = zeitpunkt("pause_ende");
  return pauseBeginn === undefined || pauseEnde === undefined
    ? [{ beginn: kommen, ende: gehen }]
    : [
        { beginn: kommen, ende: pauseBeginn },
        { beginn: pauseEnde, ende: gehen },
      ];
};

/** The bookings of a time taken over now, with the stamps it becomes */
export const buchungenPlanen = (
  zeit: ImportZeit,
  nutzerId: string,
  stempel: readonly NeueStempelung[],
  zuordnung: Zuordnung,
  stand: Stand,
): Buchungsergebnis => {
  if (zeit.projekt === undefined && zeit.taetigkeit === undefined) return { art: "keine" };
  const bezug = bezugVon(zeit, zuordnung);
  if (bezug === null) return { art: "ausgelassen" };
  if (!stand.module.projektzeit) return { art: "abgelehnt", grund: "modul_aus" };
  const stuecke = stueckeVon(stempel);
  if (stuecke.some((stueck) => stand.buchungUeberschneidet(nutzerId, stueck)))
    return { art: "abgelehnt", grund: "ueberschneidung" };
  return {
    art: "neu",
    buchungen: stuecke.map((stueck, i) => ({
      nutzerId,
      ...bezug,
      ...stueck,
      tag: zeit.tag,
      externId: buchungKennung(zeit.externalId, i + 1),
    })),
  };
};

/**
 * The bookings of a time an earlier import took over: there when they were made then; a project
 * mapped only now is not booked afterwards (the stamps may have been changed since)
 */
export const buchungenWieder = (
  zeit: ImportZeit,
  stand: Stand,
): "keine" | "vorhanden" | "ausgelassen" => {
  if (zeit.projekt === undefined && zeit.taetigkeit === undefined) return "keine";
  return stand.vorhanden.buchungen.has(buchungKennung(zeit.externalId, 1))
    ? "vorhanden"
    : "ausgelassen";
};
