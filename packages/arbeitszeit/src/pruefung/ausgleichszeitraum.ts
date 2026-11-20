import type { Befund } from "../befund.ts";
import { type Tag, wochentag } from "../kalender/tag.ts";
import { tagInBerlin } from "../kalender/zeit.ts";
import { arbzgGrenzenAm } from "./grenzen.ts";
import { arbeitsMinutenAm, type Pruefergebnis, type PruefTag, sortiert } from "./typen.ts";
import {
  spaeterer,
  tageVonBis,
  ueberschneiden,
  type Zeitraum,
  type Zeitraumart,
  zeitraumAm,
} from "./zeitraeume.ts";

/** The period the business chose (§ 3 Satz 2 ArbZG); "beide" while it has not chosen */
export type Ausgleichszeitraum = Zeitraumart | "beide";

/** The default start of the periods: calendar half-years, and 24 weeks counted from 1 January 2026 */
export const AUSGLEICH_BEGINN: Tag = "2026-01-01";

export type AusgleichOptionen = {
  /** a period has ended once its last day lies before the Berlin day of `jetzt` */
  jetzt: number;
  /** the legal holidays at the place of work: they are no Werktage (§ 3 ArbZG) */
  feiertage: ReadonlySet<Tag>;
  /** days of holiday leave and sickness: taken out of the period with their time (R-03) */
  neutral: ReadonlySet<Tag>;
  /** default "beide" */
  zeitraum?: Ausgleichszeitraum;
  /** default AUSGLEICH_BEGINN */
  beginn?: Tag;
};

/**
 * R-03: the average of a period is over 8 hours per Werktag. While the period runs it is a Hinweis
 * (`ausgleich_offen`: `ueber` minutes to balance by `zeitraum.bis`), once it has ended a Verstoß.
 * `hoechstens` is 8 hours times the `werktage` counted so far; `tage` are the days that went over
 * their share: more than 8 hours on a Werktag, or any work on a Sunday or holiday.
 */
export type AusgleichBefund = Befund<"ausgleich_offen" | "ausgleich_nicht_erreicht"> & {
  zeitraum: Zeitraum;
  minuten: number;
  hoechstens: number;
  werktage: number;
  ueber: number;
};

type Bewertung = AusgleichBefund & { beendet: boolean; ueberschritten: boolean };

type Kontext = { heute: Tag; feiertage: ReadonlySet<Tag>; neutral: ReadonlySet<Tag> };

const istWerktag = (tag: Tag, { feiertage }: Kontext): boolean =>
  wochentag(tag) !== 0 && !feiertage.has(tag);

/**
 * The limit of a period up to `stand`: 8 hours (of each day's rule version) per Werktag that is not
 * neutral; null when a day has no rule version
 */
const grenzeBis = (zeitraum: Zeitraum, stand: Tag, kontext: Kontext) => {
  let hoechstens = 0;
  let werktage = 0;
  for (const tag of tageVonBis(zeitraum.von, stand)) {
    if (!istWerktag(tag, kontext) || kontext.neutral.has(tag)) continue;
    const grenzen = arbzgGrenzenAm(tag);
    if (grenzen === null) return null;
    hoechstens += grenzen.werktaeglich;
    werktage += 1;
  }
  return { hoechstens, werktage };
};

/** The days that went over their share of the average */
const ueberAnteil = (tage: readonly PruefTag[], kontext: Kontext): Tag[] =>
  tage
    .filter((tag) => {
      const minuten = arbeitsMinutenAm(tag);
      if (!istWerktag(tag.tag, kontext)) return minuten > 0;
      return minuten > (arbzgGrenzenAm(tag.tag)?.werktaeglich ?? 0);
    })
    .map((tag) => tag.tag);

/** A period with the working days in it; null when it cannot be judged ("nicht hinterlegt") */
const bewerte = (zeitraum: Zeitraum, tage: PruefTag[], kontext: Kontext): Bewertung | null => {
  const beendet = zeitraum.bis < kontext.heute;
  const zuletzt = tage.at(-1)?.tag ?? zeitraum.von;
  const spaetester = spaeterer(kontext.heute, zuletzt);
  const stand = beendet || spaetester > zeitraum.bis ? zeitraum.bis : spaetester;
  const grenze = grenzeBis(zeitraum, stand, kontext);
  if (grenze === null) return null;
  const minuten = tage.reduce((summe, tag) => summe + arbeitsMinutenAm(tag), 0);
  return {
    regel: "R-03",
    norm: "§ 3 Satz 2 ArbZG",
    schwere: beendet ? "verstoss" : "hinweis",
    art: beendet ? "ausgleich_nicht_erreicht" : "ausgleich_offen",
    tage: ueberAnteil(tage, kontext),
    zeitraum,
    minuten,
    ...grenze,
    ueber: minuten - grenze.hoechstens,
    beendet,
    ueberschritten: minuten > grenze.hoechstens,
  };
};

/** The working days by the period of one kind they fall in; days without a rule version apart */
const nachZeitraum = (tage: readonly PruefTag[], art: Zeitraumart, beginn: Tag) => {
  const gruppen = new Map<string, { zeitraum: Zeitraum; tage: PruefTag[] }>();
  const ohne: Tag[] = [];
  for (const tag of tage) {
    const grenzen = arbzgGrenzenAm(tag.tag);
    if (grenzen === null) {
      ohne.push(tag.tag);
      continue;
    }
    const zeitraum = zeitraumAm(tag.tag, art, beginn, grenzen);
    const gruppe = gruppen.get(zeitraum.von) ?? { zeitraum, tage: [] };
    gruppe.tage.push(tag);
    gruppen.set(zeitraum.von, gruppe);
  }
  return { gruppen: [...gruppen.values()], ohne };
};

const bewerteArt = (tage: readonly PruefTag[], art: Zeitraumart, beginn: Tag, kontext: Kontext) => {
  const { gruppen, ohne } = nachZeitraum(tage, art, beginn);
  const bewertungen: Bewertung[] = [];
  const nichtHinterlegt = [...ohne];
  for (const gruppe of gruppen) {
    const bewertung = bewerte(gruppe.zeitraum, gruppe.tage, kontext);
    if (bewertung === null) nichtHinterlegt.push(...gruppe.tage.map((tag) => tag.tag));
    else bewertungen.push(bewertung);
  }
  return { bewertungen, nichtHinterlegt };
};

/**
 * Without a choice the law lets either period do, so a period over the limit counts only when an
 * overlapping period of the other kind is over it too: a Verstoß when that one has ended as well,
 * else a Hinweis while either still runs.
 */
const zaehlt = (eigene: Bewertung, andere: readonly Bewertung[]): boolean => {
  const ueber = andere.filter(
    (bewertung) => bewertung.ueberschritten && ueberschneiden(bewertung.zeitraum, eigene.zeitraum),
  );
  return eigene.beendet ? ueber.some((bewertung) => bewertung.beendet) : ueber.length > 0;
};

const ohneHilfsfelder = ({ beendet: _b, ueberschritten: _u, ...befund }: Bewertung) =>
  befund as AusgleichBefund;

/**
 * § 3 Satz 2 ArbZG: the average of six calendar months or 24 weeks stays at 8 hours per Werktag
 * (docs/regeln.md, R-03). Sunday and holiday work counts (§ 11 Abs. 2 ArbZG); neutral days leave the
 * period with their time. Pass every working day of the periods to judge, planned ones included.
 */
export const ausgleichszeitraum = (
  tage: readonly PruefTag[],
  { jetzt, feiertage, neutral, zeitraum = "beide", beginn = AUSGLEICH_BEGINN }: AusgleichOptionen,
): Pruefergebnis<AusgleichBefund> => {
  const kontext: Kontext = { heute: tagInBerlin(jetzt), feiertage, neutral };
  const zaehlen = [...tage]
    .filter((tag) => !neutral.has(tag.tag))
    .sort((a, b) => a.tag.localeCompare(b.tag));
  const arten: Zeitraumart[] = zeitraum === "beide" ? ["sechs_monate", "24_wochen"] : [zeitraum];
  const je = arten.map((art) => bewerteArt(zaehlen, art, beginn, kontext));
  const befunde = je.flatMap(({ bewertungen }, index) =>
    bewertungen
      .filter((bewertung) => bewertung.ueberschritten)
      .filter((bewertung) => {
        const andere = je[1 - index];
        return andere === undefined || zaehlt(bewertung, andere.bewertungen);
      })
      .map(ohneHilfsfelder),
  );
  return {
    befunde: befunde.sort((a, b) => a.zeitraum.von.localeCompare(b.zeitraum.von)),
    nichtHinterlegt: sortiert(je.flatMap((art) => art.nichtHinterlegt)),
  };
};
