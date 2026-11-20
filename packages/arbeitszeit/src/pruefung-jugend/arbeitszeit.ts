import type { Befund } from "../befund.ts";
import { plusTage, type Tag, wochenbeginn, wochentag } from "../kalender/tag.ts";
import { ruhetagAm } from "../pruefung-nacht-sonntag/ruhetage.ts";
import { type JugendGrenzen, jugendGrenzenAm } from "./grenzen.ts";
import {
  arbeitsMinutenAm,
  fuerJugendliche,
  type JugendOptionen,
  jugendlichAm,
  type Pruefergebnis,
  type PruefTag,
  samstagErlaubt,
  sortiert,
} from "./typen.ts";

/**
 * R-15, § 8 JArbSchG: a day over 8 hours without a shorter Werktag in the same week (`ueber_8h`),
 * over 8:30 (`ueber_8_30`), or a week over 40 hours (`ueber_40h`, `woche` its Monday, `ausfall` the
 * minutes counted for holidays). `minuten` is the working time, `grenze` the limit crossed.
 */
export type JugendArbeitszeitBefund = Befund<"ueber_8h" | "ueber_8_30" | "ueber_40h"> & {
  minuten: number;
  grenze: number;
  ueber: number;
  woche?: Tag;
  ausfall?: number;
};

type Woche = {
  montag: Tag;
  /** the minutes of each day of a Jugendlicher in the week with work */
  minuten: Map<Tag, number>;
};

/** The working days of a Jugendlicher with work, by week */
const wochenAus = (tage: readonly PruefTag[], geburtsdatum: Tag): Woche[] => {
  const wochen = new Map<Tag, Woche>();
  for (const tag of tage) {
    const grenzen = jugendGrenzenAm(tag.tag);
    const minuten = arbeitsMinutenAm(tag);
    if (grenzen === null || minuten === 0 || !jugendlichAm(geburtsdatum, tag.tag, grenzen))
      continue;
    const montag = wochenbeginn(tag.tag);
    const woche = wochen.get(montag) ?? { montag, minuten: new Map() };
    woche.minuten.set(tag.tag, (woche.minuten.get(tag.tag) ?? 0) + minuten);
    wochen.set(montag, woche);
  }
  return [...wochen.values()].sort((a, b) => a.montag.localeCompare(b.montag));
};

/** Monday to Saturday, unless a holiday at the place; null when the holidays are not known */
const werktag = (tag: Tag, optionen: JugendOptionen): boolean | null => {
  const ruhetag = ruhetagAm(tag, optionen.standort);
  return ruhetag.ok ? ruhetag.ruhetag === null : null;
};

/**
 * § 8 Abs. 2a JArbSchG: 8:30 only on a Werktag („an den übrigen Werktagen“), when another Werktag of
 * the week has work of less than 8 hours. A day off is no shortened working time (careful reading,
 * docs/regeln.md, R-15).
 */
const verkuerzt = (woche: Woche, tag: Tag, optionen: JugendOptionen, grenzen: JugendGrenzen) =>
  werktag(tag, optionen) === true &&
  [...woche.minuten].some(
    ([anderer, minuten]) =>
      anderer !== tag && minuten < grenzen.taeglich && werktag(anderer, optionen) === true,
  );

const tagesbefunde = (woche: Woche, optionen: JugendOptionen): JugendArbeitszeitBefund[] =>
  fuerJugendliche(
    [...woche.minuten],
    ([tag]) => tag,
    optionen.geburtsdatum,
    ([tag, minuten], g): JugendArbeitszeitBefund[] => {
      if (minuten <= g.taeglich) return [];
      const ausgleich = minuten > g.taeglichAusgleich;
      if (!ausgleich && verkuerzt(woche, tag, optionen, g)) return [];
      const grenze = ausgleich ? g.taeglichAusgleich : g.taeglich;
      return [
        {
          regel: "R-15",
          norm: ausgleich ? "§ 8 Abs. 2a JArbSchG" : "§ 8 Abs. 1 JArbSchG",
          schwere: "verstoss",
          art: ausgleich ? "ueber_8_30" : "ueber_8h",
          tage: [tag],
          minuten,
          grenze,
          ueber: minuten - grenze,
        },
      ];
    },
  ).befunde;

/**
 * § 4 Abs. 4 Satz 2 JArbSchG: the time lost on holidays from Monday to Saturday without work. With
 * the Soll of the day given, its minutes; without, 8 hours on a holiday from Monday to Friday, on a
 * Saturday only where Saturday work is allowed, and on no more days than the five-day week leaves
 * room for (§ 15): a day that could not have been a working day loses no time.
 */
const ausfall = (woche: Woche, optionen: JugendOptionen, grenzen: JugendGrenzen): number => {
  const feiertage = [0, 1, 2, 3, 4, 5]
    .map((versatz) => plusTage(woche.montag, versatz))
    .filter(
      (tag) =>
        !woche.minuten.has(tag) &&
        werktag(tag, optionen) === false &&
        jugendlichAm(optionen.geburtsdatum, tag, grenzen),
    );
  if (optionen.feiertagsausfall !== undefined)
    return feiertage.reduce((summe, tag) => summe + (optionen.feiertagsausfall?.(tag) ?? 0), 0);
  const moeglich = feiertage.filter(
    (tag) => wochentag(tag) !== 6 || samstagErlaubt(optionen, grenzen),
  );
  const platz = Math.max(0, grenzen.arbeitstageJeWoche - woche.minuten.size);
  return Math.min(moeglich.length, platz) * grenzen.feiertagsausfall;
};

const wochenbefund = (woche: Woche, optionen: JugendOptionen): JugendArbeitszeitBefund[] => {
  const grenzen = jugendGrenzenAm(sortiert(woche.minuten.keys())[0] as Tag);
  if (grenzen === null) return [];
  const gearbeitet = [...woche.minuten.values()].reduce((summe, minuten) => summe + minuten, 0);
  const angerechnet = ausfall(woche, optionen, grenzen);
  const minuten = gearbeitet + angerechnet;
  if (minuten <= grenzen.woechentlich) return [];
  return [
    {
      regel: "R-15",
      norm: angerechnet > 0 ? "§ 8 Abs. 1, § 4 Abs. 4 Satz 2 JArbSchG" : "§ 8 Abs. 1 JArbSchG",
      schwere: "verstoss",
      art: "ueber_40h",
      tage: sortiert(woche.minuten.keys()),
      minuten,
      grenze: grenzen.woechentlich,
      ueber: minuten - grenzen.woechentlich,
      woche: woche.montag,
      ausfall: angerechnet,
    },
  ];
};

/** The days of the week whose holidays are not known: no Werktag can be told from a holiday there */
const ohneFeiertage = (woche: Woche, optionen: JugendOptionen): Tag[] =>
  [0, 1, 2, 3, 4, 5]
    .map((versatz) => plusTage(woche.montag, versatz))
    .filter((tag) => werktag(tag, optionen) === null);

/**
 * § 8 JArbSchG on the working days of a Jugendlicher (docs/regeln.md, R-15): at most 8 hours a day,
 * 8:30 when another Werktag of the week is shorter than 8 hours, and 40 hours a week (Monday to
 * Sunday, § 4 Abs. 4), holidays counted with the time they take (§ 4 Abs. 4 Satz 2).
 */
export const jugendArbeitszeit = (
  tage: readonly PruefTag[],
  optionen: JugendOptionen,
): Pruefergebnis<JugendArbeitszeitBefund> => {
  const wochen = wochenAus(tage, optionen.geburtsdatum);
  const ohneGrenzen = fuerJugendliche(
    tage,
    (tag) => tag.tag,
    optionen.geburtsdatum,
    () => [],
  );
  return {
    befunde: wochen.flatMap((woche) => [
      ...tagesbefunde(woche, optionen),
      ...wochenbefund(woche, optionen),
    ]),
    nichtHinterlegt: sortiert([
      ...ohneGrenzen.nichtHinterlegt,
      ...wochen.flatMap((woche) => ohneFeiertage(woche, optionen)),
    ]),
  };
};
