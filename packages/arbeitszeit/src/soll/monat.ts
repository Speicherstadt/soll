import { istMonat, type Monat, monatVon, tageImMonat } from "../kalender/monat.ts";
import { istTag, type Tag } from "../kalender/tag.ts";
import { arbeitsMinutenAm, type PruefTag } from "../pruefung/typen.ts";
import { modelleGueltig } from "./modell.ts";
import {
  type KrankImUrlaubBefund,
  type SollGrundlagen,
  type TagesSoll,
  tagesSoll,
} from "./tagessoll.ts";
import { ABWESENHEITSARTEN, type Abwesenheit } from "./typen.ts";

/** A month's Soll and Ist: the absences and the working days (S-201) of the person */
export type MonatsEingaben = SollGrundlagen & {
  abwesenheiten?: readonly Abwesenheit[];
  arbeitstage?: readonly PruefTag[];
};

/**
 * Soll and Ist of a month, in whole minutes. Ist is the time worked (§ 2 Abs. 1 ArbZG, the closed
 * shifts of the working days that begin in the month) plus the minutes credited for absences;
 * the balance is what goes into the overtime account once the month is closed (S-306).
 */
export type Monatsstand = {
  monat: Monat;
  sollMinuten: number;
  gearbeitetMinuten: number;
  gutschriftMinuten: number;
  istMinuten: number;
  saldoMinuten: number;
  urlaubHalbtage: number;
  tage: TagesSoll[];
  /** days with a shift still open: its time is not known yet (R-01), so it is not counted */
  offeneTage: Tag[];
  /** R-24, one finding for all days of the month */
  befunde: KrankImUrlaubBefund[];
};

export type MonatsstandErgebnis =
  | { ok: true; wert: Monatsstand }
  | { ok: false; grund: "nicht_hinterlegt"; tage: Tag[] }
  | { ok: false; grund: "ungueltig" };

const ARTEN: ReadonlySet<string> = new Set(ABWESENHEITSARTEN);

const eingabenGueltig = (monat: Monat, eingaben: MonatsEingaben): boolean =>
  istMonat(monat) &&
  modelleGueltig(eingaben.modelle) &&
  istTag(eingaben.beschaeftigung.eintritt) &&
  (eingaben.beschaeftigung.austritt == null || istTag(eingaben.beschaeftigung.austritt)) &&
  (eingaben.beschaeftigung.ruhend ?? []).every(
    (spanne) => istTag(spanne.von) && (spanne.bis === null || istTag(spanne.bis)),
  ) &&
  (eingaben.abwesenheiten ?? []).every((a) => istTag(a.tag) && ARTEN.has(a.art)) &&
  [...(eingaben.plan ?? new Map<Tag, number>())].every(
    ([tag, minuten]) => istTag(tag) && Number.isSafeInteger(minuten) && minuten >= 0,
  );

const summe = (tage: readonly TagesSoll[], wert: (tag: TagesSoll) => number): number =>
  tage.reduce((teil, tag) => teil + wert(tag), 0);

const befundeZusammen = (tage: readonly TagesSoll[]): KrankImUrlaubBefund[] => {
  const befunde = tage.flatMap((tag) => tag.befunde);
  const [erster] = befunde;
  return erster === undefined ? [] : [{ ...erster, tage: befunde.flatMap((b) => b.tage) }];
};

/** The Soll of every day of the month; the days without a model or holidays if there are any */
const tageDesMonats = (
  monat: Monat,
  eingaben: MonatsEingaben,
): { ok: true; tage: TagesSoll[] } | { ok: false; fehlend: Tag[] } | null => {
  const tage: TagesSoll[] = [];
  const fehlend: Tag[] = [];
  for (const tag of tageImMonat(monat)) {
    const ergebnis = tagesSoll(tag, eingaben, eingaben.abwesenheiten);
    if (ergebnis.ok) tage.push(ergebnis.wert);
    else if (ergebnis.grund === "nicht_hinterlegt") fehlend.push(tag);
    else return null;
  }
  return fehlend.length > 0 ? { ok: false, fehlend } : { ok: true, tage };
};

/**
 * Soll, Ist and balance of one month (BAULISTE.md S-208). A model change within the month counts
 * each day with the model in force on it. Any day without a model or holidays makes the whole month
 * "nicht hinterlegt", naming those days: a sum with a gap would be an estimate (CLAUDE.md, "Never").
 */
export const monatsstand = (monat: Monat, eingaben: MonatsEingaben): MonatsstandErgebnis => {
  if (!eingabenGueltig(monat, eingaben)) return { ok: false, grund: "ungueltig" };
  const ergebnis = tageDesMonats(monat, eingaben);
  if (ergebnis === null) return { ok: false, grund: "ungueltig" };
  if (!ergebnis.ok) return { ok: false, grund: "nicht_hinterlegt", tage: ergebnis.fehlend };
  const arbeitstage = (eingaben.arbeitstage ?? []).filter((tag) => monatVon(tag.tag) === monat);
  const sollMinuten = summe(ergebnis.tage, (tag) => tag.sollMinuten);
  const gutschriftMinuten = summe(ergebnis.tage, (tag) => tag.gutschriftMinuten);
  const gearbeitetMinuten = arbeitstage.reduce((teil, tag) => teil + arbeitsMinutenAm(tag), 0);
  const istMinuten = gearbeitetMinuten + gutschriftMinuten;
  return {
    ok: true,
    wert: {
      monat,
      sollMinuten,
      gearbeitetMinuten,
      gutschriftMinuten,
      istMinuten,
      saldoMinuten: istMinuten - sollMinuten,
      urlaubHalbtage: summe(ergebnis.tage, (tag) => tag.urlaubHalbtage),
      tage: ergebnis.tage,
      offeneTage: arbeitstage
        .filter((tag) => tag.schichten.some((schicht) => schicht.ende === null))
        .map((tag) => tag.tag),
      befunde: befundeZusammen(ergebnis.tage),
    },
  };
};
