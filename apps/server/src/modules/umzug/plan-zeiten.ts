import {
  eingabeInBerlin,
  type Monat,
  monatVon,
  plusTage,
  type Rohstueck,
  type Stempelung,
  schichtgruppen,
} from "@soll/arbeitszeit";
import type { ImportZeit } from "@soll/import";
import type { NeueStempelung, PlanGrund, Stand } from "./plan-typen.ts";

/*
 * A span of work of another tool as stamps of Soll (BAULISTE.md S-701): Kommen at the begin, Gehen
 * at the end, a break in the middle of the span as in the plan (S-502), all on whole minutes of a
 * clock in Berlin. The tool keeps no instants of a break, so the middle is the honest place. The
 * spans of one person that form a shift are taken or refused together (review S-704).
 */

const MINUTE = 60_000;
const TAG = 24 * 60 * MINUTE;

/** The ids of the stamps of a span in Soll: "<id>/kommen", "<id>/gehen", … */
export const stempelKennung = (externalId: string, art: Stempelung["art"]): string =>
  `${externalId}/${art}`;

/** Kommen and Gehen as instants; an end at or before the begin lies on the next day */
const spanneVon = (zeit: ImportZeit): { kommen: number; gehen: number } | null => {
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

/** A span of a person to plan, with its stamps */
type Teil = { nummer: number; zeit: ImportZeit; stempel: Stempelung[]; spanne: Spanne };

/** What became of a span: its stamps and the month of its shift, or why it is refused */
export type Zeitplan = { stempel: NeueStempelung[]; monat: Monat } | PlanGrund;

/**
 * The spans of one person as shifts, cut by Soll's own rule (`schichtgruppen` of
 * @soll/arbeitszeit: a new shift 9 h after the stretch before or 24 h after the shift began), so a
 * night shift that a break after midnight splits into two spans stays one, and the import and the
 * month sheet agree by construction (review S-704)
 */
const schichtenVon = (teile: readonly Teil[]): Teil[][] => {
  const sortiert = [...teile].sort((a, b) => a.spanne.kommen - b.spanne.kommen);
  const stuecke: Rohstueck[] = sortiert.map(({ spanne }) => ({
    beginn: spanne.kommen,
    ende: spanne.gehen,
    endetMit: "gehen",
    nachPause: false,
  }));
  return schichtgruppen(stuecke).map((gruppe) => gruppe.map((i) => sortiert[i] as Teil));
};

/** Why a span of a shift cannot be taken on its own terms, or null */
const spanneGrund = (
  spanne: Spanne,
  nutzerId: string,
  stand: Stand,
  andere: readonly Spanne[],
): PlanGrund | null => {
  if (spanne.gehen > stand.jetzt) return "zukunft";
  if (
    inVorhandenen(spanne, stand.stempelVon(nutzerId)) ||
    andere.some((b) => ueberschneiden(b, spanne))
  )
    return "ueberschneidung";
  return null;
};

/**
 * A shift is decided as a whole (CLAUDE.md: a working day is the day the shift starts): each span
 * is first checked on its own as before (the future, an overlap; of two overlapping spans the one
 * earlier in the file stays, review 2 S-705), then whether a month is closed is asked once for the
 * spans that remain, for the month the shift starts in and for all their stamps together, so it
 * never takes half a shift
 */
const schichtPlanen = (
  schicht: readonly Teil[],
  nutzerId: string,
  stand: Stand,
  genommen: Genommen,
): Map<Teil, Zeitplan> => {
  const plaene = new Map<Teil, Zeitplan>();
  const bleiben: Teil[] = [];
  const bisher = genommen.get(nutzerId) ?? [];
  for (const teil of [...schicht].sort((a, b) => a.nummer - b.nummer)) {
    const andere = [...bisher, ...bleiben.map((t) => t.spanne)];
    const grund = spanneGrund(teil.spanne, nutzerId, stand, andere);
    if (grund === null) bleiben.push(teil);
    else plaene.set(teil, grund);
  }
  const monat = monatVon((schicht[0] as Teil).zeit.tag);
  // the stamps around are read only when the person has a closed month at all
  const geschlossen = stand.geschlossen(nutzerId);
  const alle = bleiben.flatMap((t) => t.stempel).sort((a, b) => a.zeitpunkt - b.zeitpunkt);
  const zu =
    bleiben.length > 0 &&
    (geschlossen.has(monat) || (geschlossen.size > 0 && stand.stempelGesperrt(nutzerId, alle)));
  if (!zu) genommen.set(nutzerId, [...bisher, ...bleiben.map((t) => t.spanne)]);
  for (const teil of bleiben)
    plaene.set(
      teil,
      zu
        ? "monat_abgeschlossen"
        : {
            monat,
            stempel: teil.stempel.map((st) => ({
              ...st,
              nutzerId,
              externId: stempelKennung(teil.zeit.externalId, st.art),
            })),
          },
    );
  return plaene;
};

/** The plan of the new spans of one person, by span */
export const zeitenEinerPerson = (
  zeiten: readonly ImportZeit[],
  nutzerId: string,
  stand: Stand,
  genommen: Genommen,
): Map<ImportZeit, Zeitplan> => {
  const plaene = new Map<ImportZeit, Zeitplan>();
  const teile: Teil[] = [];
  for (const zeit of zeiten) {
    const stempel = stempelAus(zeit);
    if (typeof stempel === "string") plaene.set(zeit, stempel);
    else {
      const spanne = {
        kommen: (stempel[0] as Stempelung).zeitpunkt,
        gehen: (stempel.at(-1) as Stempelung).zeitpunkt,
      };
      teile.push({ nummer: teile.length, zeit, stempel, spanne });
    }
  }
  for (const schicht of schichtenVon(teile)) {
    for (const [teil, plan] of schichtPlanen(schicht, nutzerId, stand, genommen))
      plaene.set(teil.zeit, plan);
  }
  return plaene;
};
