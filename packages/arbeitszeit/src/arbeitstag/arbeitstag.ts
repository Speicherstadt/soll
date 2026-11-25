import type { Befund } from "../befund.ts";
import type { Tag } from "../kalender/tag.ts";
import { beginnInBerlin, tagInBerlin } from "../kalender/zeit.ts";
import {
  type Einsatzspanne,
  einsatzGueltig,
  type MitEinsatzstempeln,
  mitEinsatzstempeln,
} from "./einsaetze.ts";
import { type Schicht, type Stueck, schichtAus, schichtgruppen } from "./schichten.ts";
import {
  durchlaufe,
  type Lauf,
  STEMPELARTEN,
  type Stempelfehler,
  type Stempelung,
} from "./stempelungen.ts";

export type StempelbefundArt = "gehen_fehlt" | Stempelfehler;

/** A finding about the stamps of a day, with the instant of the stamp or of the open start */
export type Stempelbefund = Befund<StempelbefundArt> & { zeitpunkt: number };

/**
 * The working day: the Berlin calendar day a shift begins on, with every shift that begins on it
 * (docs/regeln.md, Grundbegriffe and R-01). S-202 and S-203 build on its shifts and parts.
 */
export type Arbeitstag = {
  tag: Tag;
  schichten: Schicht[];
  /** first Kommen and last Gehen; null without a shift or while one is open */
  beginn: number | null;
  ende: number | null;
  /** § 2 Abs. 1 ArbZG: working time without the Ruhepausen, short interruptions included */
  arbeitsMinuten: number;
  pausenMinuten: number;
  /** R-01: begin, end and duration are known; a repeated stamp alone does not change that */
  vollstaendig: boolean;
  befunde: Stempelbefund[];
};

export type ArbeitstageErgebnis =
  | { ok: true; wert: Arbeitstag[] }
  | { ok: false; grund: "ungueltig" };

/** The instants a Tag can name: before 0000-01-01 and past 9999-12-31 there is no day */
const ERSTER = beginnInBerlin("0000-01-01");
const LETZTER = beginnInBerlin("9999-12-31");

/** Whether an instant names a day (S-206 checks its spans with it too) */
export const zeitpunktGueltig = (ms: number): boolean =>
  Number.isSafeInteger(ms) && ms >= ERSTER && ms < LETZTER;

const gueltig = (
  stempelungen: readonly Stempelung[],
  jetzt: number,
  einsaetze: readonly Einsatzspanne[],
): boolean =>
  zeitpunktGueltig(jetzt) &&
  stempelungen.every(
    (stempel) => STEMPELARTEN.includes(stempel.art) && zeitpunktGueltig(stempel.zeitpunkt),
  ) &&
  einsaetze.every(einsatzGueltig(zeitpunktGueltig));

const befund = (art: StempelbefundArt, tag: Tag, zeitpunkt: number): Stempelbefund => ({
  regel: "R-01",
  norm: "§ 3 Abs. 2 Nr. 1 ArbSchG",
  schwere: "hinweis",
  art,
  tage: [tag],
  zeitpunkt,
});

/** The shifts of the stamps, and for each stretch the shift it fell into */
const schichtenAus = (lauf: Lauf): { schichten: Schicht[]; schichtVon: Map<number, number> } => {
  const gruppen = schichtgruppen(lauf.stuecke);
  const offenePausen = new Set(lauf.offenePausen);
  const schichten = gruppen.map((gruppe, index) =>
    schichtAus(
      gruppe.map((stueck) => lauf.stuecke[stueck] as Lauf["stuecke"][number]),
      offenePausen.has(gruppe.at(-1) as number) ||
        (lauf.zustand === "pause" && index === gruppen.length - 1),
      lauf.stuecke[gruppen[index + 1]?.[0] ?? -1]?.beginn ?? null,
    ),
  );
  const schichtVon = new Map(
    gruppen.flatMap((gruppe, schicht) => gruppe.map((stueck) => [stueck, schicht] as const)),
  );
  return { schichten, schichtVon };
};

/** Every finding with its day: the day of its shift, or of the stamp when it belongs to none */
const befundeAus = (
  lauf: Lauf,
  schichten: readonly Schicht[],
  schichtVon: ReadonlyMap<number, number>,
  jetzt: number,
): Stempelbefund[] => {
  const ausStempeln = lauf.befunde.map(({ art, zeitpunkt, stueck }) => {
    const schicht = stueck === null ? undefined : schichten[schichtVon.get(stueck) ?? -1];
    return befund(art, schicht?.tag ?? tagInBerlin(zeitpunkt), zeitpunkt);
  });
  const offene = schichten.flatMap(({ offen, tag }) =>
    offen !== null && jetzt >= offen.faellig
      ? [befund(offen.art === "gehen" ? "gehen_fehlt" : "pause_ende_fehlt", tag, offen.seit)]
      : [],
  );
  return [...ausStempeln, ...offene].sort((a, b) => a.zeitpunkt - b.zeitpunkt);
};

const tagAus = (tag: Tag, schichten: Schicht[], befunde: Stempelbefund[]): Arbeitstag => {
  const offen = schichten.some((schicht) => schicht.offen !== null);
  const letzte = schichten.at(-1);
  return {
    tag,
    schichten,
    beginn: schichten[0]?.beginn ?? null,
    ende: offen || letzte === undefined ? null : letzte.ende,
    arbeitsMinuten: schichten.reduce((summe, schicht) => summe + schicht.arbeitsMinuten, 0),
    pausenMinuten: schichten.reduce((summe, schicht) => summe + schicht.pausenMinuten, 0),
    vollstaendig: !offen && befunde.every((eintrag) => eintrag.art === "doppelt"),
    befunde,
  };
};

/** The key of a stamp in `stempeltage`: a stamp sent twice with its kind and instant is one */
export const stempelSchluessel = ({ art, zeitpunkt }: Stempelung): string => `${art} ${zeitpunkt}`;

/** The run of the stamps with the call-outs as stamps (`mitEinsatzstempeln`), cut into shifts */
const lesen = (stempelungen: readonly Stempelung[], einsaetze: readonly Einsatzspanne[]) => {
  const eingabe = mitEinsatzstempeln(stempelungen, einsaetze);
  const lauf = durchlaufe(eingabe.stempel);
  return { eingabe, lauf, ...schichtenAus(lauf) };
};

/** The working day of the shift that holds an instant, else its own calendar day */
const tagUm = (schichten: readonly Schicht[], zeitpunkt: number): Tag =>
  schichten.find(
    (schicht) =>
      schicht.beginn <= zeitpunkt && (schicht.ende === null || zeitpunkt <= schicht.ende),
  )?.tag ?? tagInBerlin(zeitpunkt);

export type Stempeltage = {
  /** the working day of each stamp, by `stempelSchluessel` */
  stempel: Map<string, Tag>;
  /** the working day of a call-out: of the shift that holds its beginning (R-12, R-29) */
  einsatz: (einsatz: Einsatzspanne) => Tag;
};

/**
 * The working day each stamp and call-out is filed under, from the same run as `arbeitstage`: a
 * stamp goes to the day of the shift whose stretch it began, ended or was reported with, else its
 * own calendar day (a stamp without Kommen); a repeat ignored goes with the stamp it repeats; a
 * stamp a call-out covers and a call-out go to the day of the shift that holds them
 */
export const stempeltageMit = (
  stempelungen: readonly Stempelung[],
  einsaetze: readonly Einsatzspanne[],
): Stempeltage => {
  const { eingabe, lauf, schichten, schichtVon } = lesen(stempelungen, einsaetze);
  const stempel = new Map(
    lauf.zuordnungen.map((eintrag) => {
      const schicht =
        eintrag.stueck === null ? undefined : schichten[schichtVon.get(eintrag.stueck) ?? -1];
      return [stempelSchluessel(eintrag), schicht?.tag ?? tagInBerlin(eintrag.zeitpunkt)] as const;
    }),
  );
  for (const verdeckt of eingabe.verdeckt)
    stempel.set(stempelSchluessel(verdeckt), tagUm(schichten, verdeckt.zeitpunkt));
  return { stempel, einsatz: ({ beginn }) => tagUm(schichten, beginn) };
};

/** The working day each stamp is filed under, by `stempelSchluessel` (`stempeltageMit`) */
export const stempeltage = (stempelungen: readonly Stempelung[]): Map<string, Tag> =>
  stempeltageMit(stempelungen, []).stempel;

const ueberschneiden = (a: { beginn: number; ende: number }, b: Stueck): boolean =>
  a.beginn < b.ende && b.beginn < a.ende;

/**
 * The blocks of a closed shift that hold no stamped work: call-outs, whose end begins a rest and
 * whose start ends none (R-12, `ruhezeit`); given only where there are any
 */
const mitMarken = (schicht: Schicht, gestempelt: MitEinsatzstempeln["gestempelt"]): Schicht => {
  if (schicht.ende === null) return schicht;
  const werk = gestempelt.stuecke.map((stueck) => ({
    beginn: stueck.beginn,
    ende: stueck.ende ?? Number.POSITIVE_INFINITY,
  }));
  const einsaetze = schicht.bloecke.filter(
    (block) => !werk.some((teil) => ueberschneiden(teil, block)),
  );
  return einsaetze.length === 0 ? schicht : { ...schicht, einsaetze };
};

/**
 * The working days of one person's stamps (UTC milliseconds), in calendar order. `jetzt` decides
 * whether an open shift is still running or already a finding (R-01). Pass the stamps from the day
 * before the period on, so that a night shift reaching into it keeps its Kommen. Call-outs from a
 * Rufbereitschaft are read as the same times stamped (R-12, R-29, `mitEinsatzstempeln`).
 */
export const arbeitstage = (
  stempelungen: readonly Stempelung[],
  jetzt: number,
  einsaetze: readonly Einsatzspanne[] = [],
): ArbeitstageErgebnis => {
  if (!gueltig(stempelungen, jetzt, einsaetze)) return { ok: false, grund: "ungueltig" };
  const { eingabe, lauf, schichten, schichtVon } = lesen(stempelungen, einsaetze);
  const befunde = befundeAus(lauf, schichten, schichtVon, jetzt);
  const proTag = new Map<Tag, { schichten: Schicht[]; befunde: Stempelbefund[] }>();
  const zumTag = (tag: Tag) => {
    const eintrag = proTag.get(tag) ?? { schichten: [], befunde: [] };
    proTag.set(tag, eintrag);
    return eintrag;
  };
  for (const schicht of schichten)
    zumTag(schicht.tag).schichten.push(
      einsaetze.length === 0 ? schicht : mitMarken(schicht, eingabe.gestempelt),
    );
  for (const eintrag of befunde) for (const tag of eintrag.tage) zumTag(tag).befunde.push(eintrag);
  return {
    ok: true,
    wert: [...proTag.keys()].sort().map((tag) => {
      const eintrag = zumTag(tag);
      return tagAus(tag, eintrag.schichten, eintrag.befunde);
    }),
  };
};
