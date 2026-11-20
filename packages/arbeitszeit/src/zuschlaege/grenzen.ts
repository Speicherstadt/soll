import { regelversionAm } from "../jahreswerte/jahreswerte.ts";
import type { Tag } from "../kalender/tag.ts";

/** A rate of a surcharge in basis points of the Grundlohn: 2500 is 25 % */
export type Basispunkte = number;

/**
 * The limits of § 3b EStG and R 3b LStR (docs/regeln.md, R-29). Times are minutes after 0:00 on the
 * wall clock at the place of work; calendar dates are `MM-DD`.
 */
export type ZuschlagGrenzen = {
  /** § 3b Abs. 2 Satz 2 EStG: „Nachtarbeit ist die Arbeit in der Zeit von 20 Uhr bis 6 Uhr“ */
  nachtVon: number;
  nachtBis: number;
  /** § 3b Abs. 1 Nr. 1 EStG: 25 Prozent */
  nacht: Basispunkte;
  /** § 3b Abs. 3 Nr. 1 EStG: „in der Zeit von 0 Uhr bis 4 Uhr erhöht sich der Zuschlagssatz auf 40 Prozent“ */
  nachtKernBis: number;
  nachtKern: Basispunkte;
  /** § 3b Abs. 1 Nr. 2 EStG: 50 Prozent */
  sonntag: Basispunkte;
  /** § 3b Abs. 1 Nr. 3 EStG: „am 31. Dezember ab 14 Uhr und an den gesetzlichen Feiertagen 125 Prozent“ */
  feiertag: Basispunkte;
  /** § 3b Abs. 1 Nr. 4 EStG: „am 24. Dezember ab 14 Uhr, am 25. und 26. Dezember sowie am 1. Mai 150 Prozent“ */
  feiertag150: Basispunkte;
  feiertag150Tage: readonly string[];
  /** Nr. 3 and Nr. 4: „ab 14 Uhr“ on 31.12. and 24.12. */
  nachmittagAb: number;
  silvester: string;
  heiligabend: string;
  /** § 3b Abs. 2 Satz 1 EStG: der Grundlohn ist „mit höchstens 50 Euro anzusetzen“, in cents per hour */
  grundlohnHoechstensCent: number;
  /**
   * R 3b Abs. 2 LStR: with a monthly wage the hours of the regular time are the weekly hours times
   * 4,35, here in hundredths
   */
  wochenJeMonatHundertstel: number;
};

/**
 * The limits per rule version (docs/plan.md, Entscheidungen, "Regeln"). Text of § 3b EStG on
 * gesetze-im-internet.de/estg/__3b.html, as of 20.11.2026.
 */
export const ZUSCHLAG_GRENZEN: Readonly<Record<string, ZuschlagGrenzen>> = {
  "2026-1": {
    nachtVon: 20 * 60,
    nachtBis: 6 * 60,
    nacht: 2500,
    nachtKernBis: 4 * 60,
    nachtKern: 4000,
    sonntag: 5000,
    feiertag: 12500,
    feiertag150: 15000,
    feiertag150Tage: ["12-25", "12-26", "05-01"],
    nachmittagAb: 14 * 60,
    silvester: "12-31",
    heiligabend: "12-24",
    grundlohnHoechstensCent: 5000,
    wochenJeMonatHundertstel: 435,
  },
};

/** The limits in force on a day; null before the first rule version ("nicht hinterlegt") */
export const zuschlagGrenzenAm = (tag: Tag): ZuschlagGrenzen | null => {
  const version = regelversionAm(tag);
  return version.ok ? (ZUSCHLAG_GRENZEN[version.wert] ?? null) : null;
};
