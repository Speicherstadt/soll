import type { Befund } from "../befund.ts";
import type { Tag } from "../kalender/tag.ts";
import { beginnInBerlin, tagInBerlin } from "../kalender/zeit.ts";
import { type Schicht, schichtAus, schichtgruppen } from "./schichten.ts";
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

const gueltig = (stempelungen: readonly Stempelung[], jetzt: number): boolean =>
  zeitpunktGueltig(jetzt) &&
  stempelungen.every(
    (stempel) => STEMPELARTEN.includes(stempel.art) && zeitpunktGueltig(stempel.zeitpunkt),
  );

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

/**
 * The working day each stamp is filed under, by `stempelSchluessel`, from the same run as
 * `arbeitstage`: the day of the shift whose stretch it began, ended or was reported with, else its
 * own calendar day (a stamp without Kommen); a repeat ignored goes with the stamp it repeats
 */
export const stempeltage = (stempelungen: readonly Stempelung[]): Map<string, Tag> => {
  const lauf = durchlaufe(stempelungen);
  const { schichten, schichtVon } = schichtenAus(lauf);
  return new Map(
    lauf.zuordnungen.map((eintrag) => {
      const schicht =
        eintrag.stueck === null ? undefined : schichten[schichtVon.get(eintrag.stueck) ?? -1];
      return [stempelSchluessel(eintrag), schicht?.tag ?? tagInBerlin(eintrag.zeitpunkt)] as const;
    }),
  );
};

/**
 * The working days of one person's stamps (UTC milliseconds), in calendar order. `jetzt` decides
 * whether an open shift is still running or already a finding (R-01). Pass the stamps from the day
 * before the period on, so that a night shift reaching into it keeps its Kommen.
 */
export const arbeitstage = (
  stempelungen: readonly Stempelung[],
  jetzt: number,
): ArbeitstageErgebnis => {
  if (!gueltig(stempelungen, jetzt)) return { ok: false, grund: "ungueltig" };
  const lauf = durchlaufe(stempelungen);
  const { schichten, schichtVon } = schichtenAus(lauf);
  const befunde = befundeAus(lauf, schichten, schichtVon, jetzt);
  const proTag = new Map<Tag, { schichten: Schicht[]; befunde: Stempelbefund[] }>();
  const zumTag = (tag: Tag) => {
    const eintrag = proTag.get(tag) ?? { schichten: [], befunde: [] };
    proTag.set(tag, eintrag);
    return eintrag;
  };
  for (const schicht of schichten) zumTag(schicht.tag).schichten.push(schicht);
  for (const eintrag of befunde) for (const tag of eintrag.tage) zumTag(tag).befunde.push(eintrag);
  return {
    ok: true,
    wert: [...proTag.keys()].sort().map((tag) => {
      const eintrag = zumTag(tag);
      return tagAus(tag, eintrag.schichten, eintrag.befunde);
    }),
  };
};
