import { eingabeInBerlin, monatVon, plusTage, type Stempelung } from "@soll/arbeitszeit";
import type { ImportZeit } from "@soll/import";
import type { NeueStempelung, PlanGrund, Stand } from "./plan-typen.ts";

/*
 * A span of work of another tool as stamps of Soll (BAULISTE.md S-701): Kommen at the begin, Gehen
 * at the end, a break in the middle of the span as in the plan (S-502), all on whole minutes of a
 * clock in Berlin. The tool keeps no instants of a break, so the middle is the honest place.
 */

const MINUTE = 60_000;
const TAG = 24 * 60 * MINUTE;

/** The ids of the stamps of a span in Soll: "<id>/kommen", "<id>/gehen", … */
export const stempelKennung = (externalId: string, art: Stempelung["art"]): string =>
  `${externalId}/${art}`;

/** Kommen and Gehen as instants; an end at or before the begin lies on the next day */
export const spanneVon = (zeit: ImportZeit): { kommen: number; gehen: number } | null => {
  const kommen = eingabeInBerlin(zeit.tag, zeit.beginn);
  const gehen = eingabeInBerlin(
    zeit.ende > zeit.beginn ? zeit.tag : plusTage(zeit.tag, 1),
    zeit.ende,
  );
  return kommen === null || gehen === null ? null : { kommen, gehen };
};

/**
 * The stamps of a span, or why there are none: a time the clocks skip in spring has no instant, and
 * on the night of the change a break can be as long as the span itself
 */
export const stempelAus = (zeit: ImportZeit): Stempelung[] | PlanGrund => {
  const spanne = spanneVon(zeit);
  if (spanne === null) return "zeit_gibt_es_nicht";
  const dauer = (spanne.gehen - spanne.kommen) / MINUTE;
  if (zeit.pauseMinuten >= dauer) return "pause_ungueltig";
  if (zeit.pauseMinuten === 0)
    return [
      { art: "kommen", zeitpunkt: spanne.kommen },
      { art: "gehen", zeitpunkt: spanne.gehen },
    ];
  const pauseBeginn = spanne.kommen + Math.floor((dauer - zeit.pauseMinuten) / 2) * MINUTE;
  return [
    { art: "kommen", zeitpunkt: spanne.kommen },
    { art: "pause_beginn", zeitpunkt: pauseBeginn },
    { art: "pause_ende", zeitpunkt: pauseBeginn + zeit.pauseMinuten * MINUTE },
    { art: "gehen", zeitpunkt: spanne.gehen },
  ];
};

type Spanne = { kommen: number; gehen: number };

/**
 * Whether a span falls into the stamps there already: a stamp inside it, or a shift that runs at its
 * begin (the last stamp before it, within a day, is no Gehen)
 */
const inVorhandenen = (spanne: Spanne, vorhanden: readonly Stempelung[]): boolean => {
  if (vorhanden.some((s) => s.zeitpunkt >= spanne.kommen && s.zeitpunkt <= spanne.gehen))
    return true;
  const davor = vorhanden.filter((s) => s.zeitpunkt < spanne.kommen).at(-1);
  return davor !== undefined && davor.art !== "gehen" && spanne.kommen - davor.zeitpunkt < TAG;
};

const ueberschneiden = (a: Spanne, b: Spanne): boolean => a.kommen < b.gehen && b.kommen < a.gehen;

/** What the plan of times remembers per person: the spans it took so far */
export type Genommen = Map<string, Spanne[]>;

/** The stamps of one span of a person, or why it is refused */
export const zeitPlanen = (
  zeit: ImportZeit,
  nutzerId: string,
  stand: Stand,
  genommen: Genommen,
): NeueStempelung[] | PlanGrund => {
  const stempel = stempelAus(zeit);
  if (typeof stempel === "string") return stempel;
  const spanne = {
    kommen: (stempel[0] as Stempelung).zeitpunkt,
    gehen: (stempel.at(-1) as Stempelung).zeitpunkt,
  };
  if (spanne.gehen > stand.jetzt) return "zukunft";
  const bisher = genommen.get(nutzerId) ?? [];
  if (
    inVorhandenen(spanne, stand.stempelVon(nutzerId)) ||
    bisher.some((b) => ueberschneiden(b, spanne))
  )
    return "ueberschneidung";
  // the stamps around are read only when the person has a closed month at all
  const geschlossen = stand.geschlossen(nutzerId);
  if (
    geschlossen.has(monatVon(zeit.tag)) ||
    (geschlossen.size > 0 && stand.stempelGesperrt(nutzerId, stempel))
  )
    return "monat_abgeschlossen";
  genommen.set(nutzerId, [...bisher, spanne]);
  return stempel.map((s) => ({ ...s, nutzerId, externId: stempelKennung(zeit.externalId, s.art) }));
};
