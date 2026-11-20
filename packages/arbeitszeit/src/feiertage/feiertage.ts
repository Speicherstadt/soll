import { istTag, plusTage, type Tag, tagAus, wochentag } from "../kalender/tag.ts";
import { FEIERTAGSGESETZ, REGIONEN, type Standort } from "./laender.ts";
import { ostersonntag } from "./ostern.ts";
import { FEIERTAGE, type FeiertagsRegel, FRUEHESTES_JAHR, type Termin } from "./regeln.ts";

export type Feiertag = { tag: Tag; schluessel: string; name: string; norm: string };

export type FeiertageErgebnis =
  | { ok: true; feiertage: Feiertag[] }
  | { ok: false; grund: "nicht_hinterlegt" };

const bussUndBettag = (jahr: number): Tag => {
  const vor = plusTage(tagAus(jahr, 11, 23), -1);
  // back from 22 November to the nearest Wednesday (3)
  return plusTage(vor, -((wochentag(vor) - 3 + 7) % 7));
};

const terminIn = (termin: Termin, jahr: number): Tag => {
  if (termin.art === "fest") return tagAus(jahr, termin.monat, termin.tag);
  if (termin.art === "ostern") return plusTage(ostersonntag(jahr), termin.abstand);
  return bussUndBettag(jahr);
};

const giltFuer = (regel: FeiertagsRegel, jahr: number, standort: Standort): boolean =>
  (regel.laender === "alle" || regel.laender.includes(standort.land)) &&
  (regel.ab === undefined || jahr >= regel.ab) &&
  (regel.bis === undefined || jahr <= regel.bis) &&
  (regel.regionen === undefined ||
    // a region counts only in its own Land (Fronleichnam in Saxony is not Fronleichnam in Thuringia)
    regel.regionen.some(
      (region) => REGIONEN[region] === standort.land && standort.regionen?.includes(region),
    ));

/**
 * The legal holidays of one year at one place, sorted by day, each with the law that sets it. Years
 * before FRUEHESTES_JAHR are "nicht hinterlegt": Soll does not guess from later law.
 */
export const feiertage = (jahr: number, standort: Standort): FeiertageErgebnis => {
  if (!Number.isInteger(jahr) || jahr < FRUEHESTES_JAHR)
    return { ok: false, grund: "nicht_hinterlegt" };
  const liste = FEIERTAGE.filter((regel) => giltFuer(regel, jahr, standort))
    .map((regel) => ({
      tag: terminIn(regel.termin, jahr),
      schluessel: regel.schluessel,
      name: regel.name,
      norm: FEIERTAGSGESETZ[standort.land],
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
  return { ok: true, feiertage: liste };
};

export type FeiertagErgebnis =
  | { ok: true; feiertag: Feiertag | null }
  | { ok: false; grund: "nicht_hinterlegt" };

/** The holiday on a day at a place, null on a working day, or "nicht hinterlegt" before the data */
export const feiertagAm = (tag: Tag, standort: Standort): FeiertagErgebnis => {
  if (!istTag(tag)) return { ok: false, grund: "kein_tag" };
  const ergebnis = feiertage(Number(tag.slice(0, 4)), standort);
  if (!ergebnis.ok) return ergebnis;
  return {
    ok: true,
    feiertag: ergebnis.feiertage.find((feiertag) => feiertag.tag === tag) ?? null,
  };
};
