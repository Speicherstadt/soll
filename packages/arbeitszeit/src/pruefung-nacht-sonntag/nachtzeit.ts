import type { Stueck } from "../arbeitstag/schichten.ts";
import { jahrVon, plusTage, type Tag } from "../kalender/tag.ts";
import { tagInBerlin, zeitpunktInBerlin } from "../kalender/zeit.ts";
import { type NachtSonntagGrenzen, nachtSonntagGrenzenAm, type Uhrzeitspanne } from "./grenzen.ts";
import {
  gemeinsameMinuten,
  geschlossen,
  type PruefSchicht,
  type PruefTag,
  sortiert,
} from "./typen.ts";

export type NachtOptionen = {
  /** § 2 Abs. 3 ArbZG: Bäckereien und Konditoreien have the Nachtzeit 22 to 5 h; default false */
  baeckerei?: boolean;
  /**
   * § 2 Abs. 5 Nr. 1 ArbZG: the person normally works nights in Wechselschicht (a mark on the
   * employee, S-303); default false, and Soll counts the days of Nr. 2 in any case
   */
  wechselschicht?: boolean;
};

/** Why a person is a Nachtarbeitnehmer on a day (§ 2 Abs. 5 ArbZG), null when not */
export type Nachtarbeitnehmergrund = "wechselschicht" | "tage" | "vorjahr" | null;

/** The night work of one working day (docs/regeln.md, R-06) */
export type Nachttag = {
  tag: Tag;
  /** minutes in the Nachtzeit of the shift with the most of them */
  nachtMinuten: number;
  /** § 2 Abs. 4 ArbZG: a shift of the day has more than two hours in the Nachtzeit */
  nachtarbeit: boolean;
  /** the how-manieth Nachtarbeitstag of the calendar year this is; null without Nachtarbeit */
  nummer: number | null;
  nachtarbeitnehmer: Nachtarbeitnehmergrund;
};

/** The Nachtzeit that begins on the evening of `tag`, as instants */
const nachtAb = (tag: Tag, spanne: Uhrzeitspanne): Stueck => {
  const beginn = zeitpunktInBerlin(tag, spanne.von);
  const ende = zeitpunktInBerlin(spanne.bis > spanne.von ? tag : plusTage(tag, 1), spanne.bis);
  return { beginn, ende, minuten: 0 };
};

/** Minutes of a span of work in the Nachtzeit: every night from the evening before its first day */
const nachtMinutenIn = (stueck: Stueck, spanne: Uhrzeitspanne): number => {
  let minuten = 0;
  const letzter = tagInBerlin(stueck.ende);
  for (let tag = plusTage(tagInBerlin(stueck.beginn), -1); tag <= letzter; tag = plusTage(tag, 1))
    minuten += gemeinsameMinuten(stueck, nachtAb(tag, spanne));
  return minuten;
};

/** § 2 Abs. 3 ArbZG: the minutes of a shift's work, short interruptions included, in the Nachtzeit */
export const nachtMinuten = (schicht: PruefSchicht, spanne: Uhrzeitspanne): number =>
  schicht.bloecke.reduce((summe, block) => summe + nachtMinutenIn(block, spanne), 0);

const nachtzeitVon = (grenzen: NachtSonntagGrenzen, { baeckerei = false }: NachtOptionen) =>
  baeckerei ? grenzen.nachtzeitBaeckerei : grenzen.nachtzeit;

type Gezaehlt = { tag: Tag; nachtMinuten: number; nachtarbeit: boolean; ab: number };

/** Each day's night minutes and whether it is a Nachtarbeitstag; null without a rule version */
const zaehle = (tag: PruefTag, optionen: NachtOptionen): Gezaehlt | null => {
  const grenzen = nachtSonntagGrenzenAm(tag.tag);
  if (grenzen === null) return null;
  const spanne = nachtzeitVon(grenzen, optionen);
  const minuten = geschlossen(tag).map((schicht) => nachtMinuten(schicht, spanne));
  const meiste = Math.max(0, ...minuten);
  return {
    tag: tag.tag,
    nachtMinuten: meiste,
    nachtarbeit: meiste > grenzen.nachtarbeitUeber,
    ab: grenzen.nachtarbeitnehmerAb,
  };
};

/**
 * The night work of one person's working days (docs/regeln.md, R-06): night minutes, Nachtarbeit,
 * the count of Nachtarbeitstage in the calendar year and whether the person is a Nachtarbeitnehmer.
 * From the 48th Nachtarbeitstag on, a person is one for the rest of that year and the whole next
 * (whoever worked 48 nights last year will again, the law asks for the current year); pass the
 * working days from 1 January of the year before.
 */
export const nachttage = (
  tage: readonly PruefTag[],
  optionen: NachtOptionen = {},
): { tage: Nachttag[]; nichtHinterlegt: Tag[] } => {
  const sortierteTage = [...tage].sort((a, b) => a.tag.localeCompare(b.tag));
  const nichtHinterlegt: Tag[] = [];
  const gezaehlt: Gezaehlt[] = [];
  for (const tag of sortierteTage) {
    const eintrag = zaehle(tag, optionen);
    if (eintrag === null) nichtHinterlegt.push(tag.tag);
    else gezaehlt.push(eintrag);
  }
  const jeJahr = new Map<number, number>();
  const ergebnis = gezaehlt.map(({ tag, nachtMinuten, nachtarbeit, ab }): Nachttag => {
    const jahr = jahrVon(tag);
    const nummer = nachtarbeit ? (jeJahr.get(jahr) ?? 0) + 1 : null;
    if (nummer !== null) jeJahr.set(jahr, nummer);
    const bisher = jeJahr.get(jahr) ?? 0;
    const grund: Nachtarbeitnehmergrund = optionen.wechselschicht
      ? "wechselschicht"
      : (jeJahr.get(jahr - 1) ?? 0) >= ab
        ? "vorjahr"
        : bisher >= ab
          ? "tage"
          : null;
    return { tag, nachtMinuten, nachtarbeit, nummer, nachtarbeitnehmer: grund };
  });
  return { tage: ergebnis, nichtHinterlegt: sortiert(nichtHinterlegt) };
};
