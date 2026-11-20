import type { Befund } from "../befund.ts";
import { ostersonntag } from "../feiertage/ostern.ts";
import { type Monat, monatVon, tageImMonat } from "../kalender/monat.ts";
import { jahrVon, plusTage, type Tag, wochenbeginn, wochentag } from "../kalender/tag.ts";
import { beginnInBerlin, zeitpunktInBerlin } from "../kalender/zeit.ts";
import {
  kalendertageMitArbeit,
  type Ruhetag,
  ruhetagAm,
} from "../pruefung-nacht-sonntag/ruhetage.ts";
import { arbeitsbloecke, gemeinsameMinuten } from "../pruefung-nacht-sonntag/typen.ts";
import type { JugendGrenzen } from "./grenzen.ts";
import {
  fuerJugendliche,
  type JugendOptionen,
  nachTag,
  type Pruefergebnis,
  type PruefTag,
  samstagErlaubt,
  sonntagErlaubt,
  sortiert,
} from "./typen.ts";

/**
 * R-20, §§ 15 to 18 JArbSchG: more than five days of work in a week (`ueber_5_tage`, `anzahl`), work
 * on a Saturday, Sunday or holiday without a case that allows it (`samstag`, `sonntag`, `feiertag`),
 * fewer than two free Sundays in a month (`sonntage_frei`, `frei` of `sonntage`), or work after
 * 14 Uhr on 24 and 31 December (`nach_14_uhr`, `minuten`).
 */
export type JugendRuhetagBefund = Befund<
  "ueber_5_tage" | "samstag" | "sonntag" | "feiertag" | "sonntage_frei" | "nach_14_uhr"
> & {
  anzahl?: number;
  frei?: number;
  sonntage?: number;
  minuten?: number;
  feiertag?: string | null;
};

/** A calendar day of a Jugendlicher with work, its Sunday or holiday and its limits */
type Arbeitstag = { tag: Tag; ruhetag: Ruhetag | null; grenzen: JugendGrenzen };

const befund = (
  art: JugendRuhetagBefund["art"],
  norm: string,
  tage: Tag[],
  felder: Partial<JugendRuhetagBefund> = {},
): JugendRuhetagBefund => ({ regel: "R-20", norm, schwere: "verstoss", art, tage, ...felder });

/** § 15 Satz 1: „nur an fünf Tagen in der Woche“, Monday to Sunday (§ 4 Abs. 4) */
const fuenfTage = (tage: readonly Arbeitstag[]): JugendRuhetagBefund[] => {
  const wochen = Map.groupBy(tage, (tag) => wochenbeginn(tag.tag));
  return [...wochen.values()].flatMap((woche) => {
    const grenzen = woche[0]?.grenzen;
    if (grenzen === undefined || woche.length <= grenzen.arbeitstageJeWoche) return [];
    const tageDerWoche = woche.map((tag) => tag.tag);
    return [befund("ueber_5_tage", "§ 15 Satz 1 JArbSchG", tageDerWoche, { anzahl: woche.length })];
  });
};

/** § 18 Abs. 2: never on 25 December, 1 January, Easter Sunday and 1 May, wherever it is a holiday */
const nieErlaubt = (tag: Tag, grenzen: JugendGrenzen): boolean =>
  grenzen.nieTage.includes(tag.slice(5)) || tag === ostersonntag(jahrVon(tag));

/** §§ 16 to 18 on one day: Saturday, Sunday, holiday */
const ruhetagBefunde = (tag: Arbeitstag, optionen: JugendOptionen): JugendRuhetagBefund[] => {
  const { grenzen, ruhetag } = tag;
  const sonntag = sonntagErlaubt(optionen, grenzen);
  const feiertag = ruhetag?.feiertag ?? null;
  const befunde: JugendRuhetagBefund[] = [];
  if (wochentag(tag.tag) === 6 && !samstagErlaubt(optionen, grenzen))
    befunde.push(befund("samstag", "§ 16 Abs. 1 JArbSchG", [tag.tag]));
  if (wochentag(tag.tag) === 0 && !sonntag)
    befunde.push(befund("sonntag", "§ 17 Abs. 1 JArbSchG", [tag.tag]));
  if (feiertag !== null && !sonntag)
    befunde.push(
      befund("feiertag", "§ 18 Abs. 1 JArbSchG", [tag.tag], { feiertag: feiertag.name }),
    );
  else if (nieErlaubt(tag.tag, grenzen))
    befunde.push(
      befund("feiertag", "§ 18 Abs. 2 JArbSchG", [tag.tag], { feiertag: feiertag?.name ?? null }),
    );
  return befunde;
};

/** The Sundays of a month on which the person is a Jugendlicher */
const sonntageImMonat = (monat: Monat, optionen: JugendOptionen): Tag[] => {
  const sonntage = tageImMonat(monat).filter((tag) => wochentag(tag) === 0);
  return fuerJugendliche(
    sonntage,
    (tag) => tag,
    optionen.geburtsdatum,
    (tag) => [tag],
  ).befunde;
};

/**
 * § 17 Abs. 2 Satz 2: „mindestens zwei Sonntage im Monat müssen beschäftigungsfrei bleiben“; a
 * Verstoß as soon as so many are worked that two can no longer stay free
 */
const freieSonntage = (tage: readonly Arbeitstag[], optionen: JugendOptionen) => {
  const sonntage = tage.filter((tag) => wochentag(tag.tag) === 0);
  const monate = Map.groupBy(sonntage, (tag) => monatVon(tag.tag));
  return [...monate].flatMap(([monat, gearbeitet]): JugendRuhetagBefund[] => {
    const grenzen = gearbeitet[0]?.grenzen;
    if (grenzen === undefined || !sonntagErlaubt(optionen, grenzen)) return [];
    const alle = sonntageImMonat(monat, optionen).length;
    const frei = alle - gearbeitet.length;
    if (frei >= Math.min(grenzen.freieSonntage, alle)) return [];
    const tageDesMonats = gearbeitet.map((tag) => tag.tag);
    return [
      befund("sonntage_frei", "§ 17 Abs. 2 Satz 2 JArbSchG", tageDesMonats, {
        frei,
        sonntage: alle,
      }),
    ];
  });
};

/** § 18 Abs. 1: „Am 24. und 31. Dezember nach 14 Uhr“, in real minutes up to midnight */
const nach14Uhr = (tag: Arbeitstag, bloecke: ReturnType<typeof arbeitsbloecke>) => {
  if (!tag.grenzen.dezemberTage.includes(tag.tag.slice(5))) return [];
  const abend = {
    beginn: zeitpunktInBerlin(tag.tag, tag.grenzen.dezemberBis),
    ende: beginnInBerlin(plusTage(tag.tag, 1)),
  };
  const minuten = bloecke.reduce((summe, block) => summe + gemeinsameMinuten(block, abend), 0);
  return minuten === 0
    ? []
    : [befund("nach_14_uhr", "§ 18 Abs. 1 JArbSchG", [tag.tag], { minuten })];
};

/**
 * §§ 15 to 18 JArbSchG on the calendar days of a Jugendlicher into which work falls from 0 to 24 Uhr
 * (docs/regeln.md, R-20): five days a week, Saturdays, Sundays and holidays at the place of work
 * only in the cases of § 16 Abs. 2 and § 17 Abs. 2, two free Sundays a month, and the days of § 18.
 */
export const jugendRuhetage = (
  tage: readonly PruefTag[],
  optionen: JugendOptionen,
): Pruefergebnis<JugendRuhetagBefund> => {
  const ohneFeiertage: Tag[] = [];
  const gepruefte = fuerJugendliche(
    sortiert(kalendertageMitArbeit(tage)),
    (tag) => tag,
    optionen.geburtsdatum,
    (tag, grenzen): Arbeitstag[] => {
      const ruhetag = ruhetagAm(tag, optionen.standort);
      if (ruhetag.ok) return [{ tag, ruhetag: ruhetag.ruhetag, grenzen }];
      ohneFeiertage.push(tag);
      return [];
    },
  );
  const arbeitstage = gepruefte.befunde;
  const bloecke = arbeitsbloecke(tage);
  return {
    befunde: nachTag([
      ...fuenfTage(arbeitstage),
      ...arbeitstage.flatMap((tag) => ruhetagBefunde(tag, optionen)),
      ...freieSonntage(arbeitstage, optionen),
      ...arbeitstage.flatMap((tag) => nach14Uhr(tag, bloecke)),
    ]),
    nichtHinterlegt: sortiert([...gepruefte.nichtHinterlegt, ...ohneFeiertage]),
  };
};
