import {
  eingabeInBerlin,
  type Monat,
  monatVon,
  plusTage,
  type Stempelung,
  stempelSchluessel,
  stempeltage,
  type Tag,
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
type Teil = { zeit: ImportZeit; stempel: Stempelung[]; spanne: Spanne };

/** What became of a span: its stamps and the month of its shift, or why it is refused */
export type Zeitplan = { stempel: NeueStempelung[]; monat: Monat } | PlanGrund;

/** Why a span cannot be taken on its own terms, or null */
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
 * The working day of each span by Soll's own month content: `stempeltage` over the person's stamps
 * there already and those of the spans to take, so a span that continues a shift (one already in
 * Soll included) is filed under the day that shift began (CLAUDE.md, "Time"; review S-704)
 */
const arbeitstageVon = (teile: readonly Teil[], vorhanden: readonly Stempelung[]) => {
  const tage = stempeltage(
    [...vorhanden, ...teile.flatMap((t) => t.stempel)].sort((a, b) => a.zeitpunkt - b.zeitpunkt),
  );
  const jeTag = new Map<Tag, Teil[]>();
  for (const teil of teile) {
    const tag = tage.get(stempelSchluessel(teil.stempel[0] as Stempelung)) ?? teil.zeit.tag;
    jeTag.set(tag, [...(jeTag.get(tag) ?? []), teil]);
  }
  return jeTag;
};

/**
 * The spans of one working day are decided together: whether a month is closed is asked once, for
 * the month of that day and for all their stamps, so a shift is never taken by halves
 */
const tagPlanen = (
  tag: Tag,
  teile: readonly Teil[],
  nutzerId: string,
  stand: Stand,
): Zeitplan[] => {
  const monat = monatVon(tag);
  // the stamps around are read only when the person has a closed month at all
  const geschlossen = stand.geschlossen(nutzerId);
  const alle = teile.flatMap((t) => t.stempel).sort((a, b) => a.zeitpunkt - b.zeitpunkt);
  if (geschlossen.has(monat) || (geschlossen.size > 0 && stand.stempelGesperrt(nutzerId, alle)))
    return teile.map(() => "monat_abgeschlossen");
  return teile.map((teil) => ({
    monat,
    stempel: teil.stempel.map((st) => ({
      ...st,
      nutzerId,
      externId: stempelKennung(teil.zeit.externalId, st.art),
    })),
  }));
};

/**
 * The plan of the new spans of one person, by span: each first on its own in the order of the file
 * (the future, an overlap; of two overlapping spans the earlier in the file stays, review 2 S-705),
 * then the rest by working day
 */
export const zeitenEinerPerson = (
  zeiten: readonly ImportZeit[],
  nutzerId: string,
  stand: Stand,
  genommen: Genommen,
): Map<ImportZeit, Zeitplan> => {
  const plaene = new Map<ImportZeit, Zeitplan>();
  const bisher = genommen.get(nutzerId) ?? [];
  const bleiben: Teil[] = [];
  for (const zeit of zeiten) {
    const stempel = stempelAus(zeit);
    if (typeof stempel === "string") {
      plaene.set(zeit, stempel);
      continue;
    }
    const spanne = {
      kommen: (stempel[0] as Stempelung).zeitpunkt,
      gehen: (stempel.at(-1) as Stempelung).zeitpunkt,
    };
    const grund = spanneGrund(spanne, nutzerId, stand, [
      ...bisher,
      ...bleiben.map((t) => t.spanne),
    ]);
    if (grund === null) bleiben.push({ zeit, stempel, spanne });
    else plaene.set(zeit, grund);
  }
  const genommeneSpannen = [...bisher];
  for (const [tag, teile] of arbeitstageVon(bleiben, stand.stempelVon(nutzerId))) {
    const ergebnisse = tagPlanen(tag, teile, nutzerId, stand);
    teile.forEach((teil, i) => {
      const plan = ergebnisse[i] as Zeitplan;
      plaene.set(teil.zeit, plan);
      if (typeof plan !== "string") genommeneSpannen.push(teil.spanne);
    });
  }
  genommen.set(nutzerId, genommeneSpannen);
  return plaene;
};
