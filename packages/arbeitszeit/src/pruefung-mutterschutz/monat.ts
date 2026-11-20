import type { Befund } from "../befund.ts";
import { type Monat, monatVon, tageImMonat } from "../kalender/monat.ts";
import {
  arbeitsMinutenAm,
  fuerGeschuetzte,
  inSpanne,
  type MutterschutzOptionen,
  type Pruefergebnis,
  type PruefTag,
  sortiert,
} from "./typen.ts";

/**
 * R-21, § 4 Abs. 1 Satz 4 MuSchG: the working time of a calendar month (`monat`, `YYYY-MM`) is more
 * than the contractual weekly working time in its average; `erlaubt` is that time in whole minutes,
 * rounded down, `ueber` the minutes past it
 */
export type MonatBefund = Befund<"ueber_vertrag"> & {
  monat: Monat;
  minuten: number;
  erlaubt: number;
  ueber: number;
};

/**
 * Seven times the minutes allowed in a month: the contractual weekly time of each day of the month
 * in a span of the mark, a seventh of it per day; null when one of them is not known
 */
const erlaubtMalSieben = (monat: Monat, optionen: MutterschutzOptionen): number | null => {
  let summe = 0;
  for (const tag of tageImMonat(monat).filter((tag) => inSpanne(optionen.zeitraeume, tag))) {
    const woche = optionen.wochenarbeitszeitAm?.(tag) ?? null;
    if (woche === null) return null;
    summe += woche;
  }
  return summe;
};

/**
 * § 4 Abs. 1 Satz 4 MuSchG (docs/regeln.md, R-21): „nicht in einem Umfang …, der die vertraglich
 * vereinbarte wöchentliche Arbeitszeit im Durchschnitt des Monats übersteigt“. Whole minutes without
 * rounding: minutes × 7 ≤ the sum of the weekly time over the days of the month in a span of the
 * mark. A Verstoß as soon as the work of the month is past it; without the weekly time of a day the
 * month is "nicht hinterlegt".
 */
export const monatsdurchschnitt = (
  tage: readonly PruefTag[],
  optionen: MutterschutzOptionen,
): Pruefergebnis<MonatBefund> => {
  const geprueft = fuerGeschuetzte(
    tage,
    (tag) => tag.tag,
    optionen.zeitraeume,
    (tag) => (arbeitsMinutenAm(tag) > 0 ? [{ tag: tag.tag, minuten: arbeitsMinutenAm(tag) }] : []),
  );
  const monate = Map.groupBy(geprueft.befunde, (tag) => monatVon(tag.tag));
  const nichtHinterlegt = [...geprueft.nichtHinterlegt];
  const befunde = [...monate].flatMap(([monat, gearbeitet]): MonatBefund[] => {
    const tageDesMonats = sortiert(gearbeitet.map((tag) => tag.tag));
    const malSieben = erlaubtMalSieben(monat, optionen);
    if (malSieben === null) {
      nichtHinterlegt.push(...tageDesMonats);
      return [];
    }
    const minuten = gearbeitet.reduce((summe, tag) => summe + tag.minuten, 0);
    if (minuten * 7 <= malSieben) return [];
    const erlaubt = Math.floor(malSieben / 7);
    return [
      {
        regel: "R-21",
        norm: "§ 4 Abs. 1 Satz 4 MuSchG",
        schwere: "verstoss",
        art: "ueber_vertrag",
        tage: tageDesMonats,
        monat,
        minuten,
        erlaubt,
        ueber: minuten - erlaubt,
      },
    ];
  });
  return { befunde, nichtHinterlegt: sortiert(nichtHinterlegt) };
};
