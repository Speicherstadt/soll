import type { Befund } from "../befund.ts";
import { abschnitte, mindestlohnAm, regelversionAm } from "../jahreswerte/jahreswerte.ts";
import { letzterTag, type Monat } from "../kalender/monat.ts";
import { istTag, type Tag } from "../kalender/tag.ts";
import { geschlossen, type Pruefergebnis, sortiert } from "../pruefung/typen.ts";
import { BEFRISTETE_AUSNAHMEN, MILOG_AUSNAHMEN, type MiLoGAusnahmegrund } from "./grenzen.ts";
import {
  arbeitsMinutenIm,
  centAbgerundet,
  centAufgerundet,
  type LohnErgebnis,
  type Lohnmonat,
  lohnMal60,
  monateGueltig,
  tageMitArbeit,
  type Zuschlag,
} from "./lohn.ts";

/**
 * An exception of § 22 MiLoG on the employee, up to and including `bis` (without `bis`: for good,
 * except for the grounds the law limits in time). It excepts a month only when it covers all of it:
 * a month it covers in part is checked in full, never less strictly than the law.
 */
export type MiLoGAusnahme = { grund: MiLoGAusnahmegrund; bis?: Tag };

export type MindestlohnOptionen = { ausnahmen?: readonly MiLoGAusnahme[] };

/**
 * R-14: the wage of the month is below the minimum wage for its minutes. `lohnCent` is the wage
 * counted (rounded down where an hourly wage leaves a fraction), `mindestlohnCent` what the minutes
 * are owed at least and `fehlendCent` the gap, both rounded up: never to the employee's disadvantage.
 */
export type MindestlohnBefund = Befund<"unter_mindestlohn"> & {
  monat: Monat;
  minuten: number;
  lohnCent: number;
  mindestlohnCent: number;
  fehlendCent: number;
};

/**
 * Surcharges for Sunday and holiday work count towards the minimum wage (BAG, 24.05.2017,
 * 5 AZR 431/16; 17.01.2018, 5 AZR 69/17), the night surcharge of § 6 Abs. 5 ArbZG does not (BAG,
 * 25.05.2016, 5 AZR 135/16)
 */
const ANRECHENBAR: ReadonlySet<Zuschlag["art"]> = new Set(["sonntag", "feiertag"]);

const ausgenommen = (monat: Monat, ausnahmen: readonly MiLoGAusnahme[]): boolean =>
  ausnahmen.some(({ grund, bis }) => {
    if (!MILOG_AUSNAHMEN.includes(grund)) return false;
    if (bis === undefined) return !BEFRISTETE_AUSNAHMEN.includes(grund);
    return istTag(bis) && bis >= letzterTag(monat);
  });

type Soll = { mal60: number; nichtHinterlegt: Tag[] };

/**
 * What the minutes of the month are owed at least, times 60 (cents per hour × minutes): each block of
 * work at the minimum wage of the calendar day its minutes fall on, so a night shift over 1 January
 * owes its hours after midnight at the new rate (S-104, `abschnitte`)
 */
const mindestlohnMal60 = (monat: Lohnmonat): Soll => {
  let mal60 = 0;
  const nichtHinterlegt: Tag[] = [];
  for (const tag of monat.tage) {
    if (!regelversionAm(tag.tag).ok) nichtHinterlegt.push(tag.tag);
    for (const block of geschlossen(tag).flatMap((schicht) => schicht.bloecke)) {
      const teile = abschnitte(block.beginn, block.ende, mindestlohnAm);
      for (const teil of teile.ok ? teile.wert : []) {
        if (teil.wert.ok) mal60 += teil.wert.wert * teil.minuten;
        else nichtHinterlegt.push(tag.tag);
      }
    }
  }
  return { mal60, nichtHinterlegt: sortiert(nichtHinterlegt) };
};

const pruefeMonat = (monat: Lohnmonat, soll: Soll): MindestlohnBefund[] => {
  const lohn = lohnMal60(monat, (zuschlag) => ANRECHENBAR.has(zuschlag.art));
  if (lohn >= soll.mal60) return [];
  return [
    {
      regel: "R-14",
      norm: "§ 1 Abs. 1 MiLoG",
      schwere: "verstoss",
      art: "unter_mindestlohn",
      tage: tageMitArbeit(monat),
      monat: monat.monat,
      minuten: arbeitsMinutenIm(monat),
      lohnCent: centAbgerundet(lohn),
      mindestlohnCent: centAufgerundet(soll.mal60),
      fehlendCent: centAufgerundet(soll.mal60 - lohn),
    },
  ];
};

/**
 * § 1 MiLoG per month (docs/regeln.md, R-14), in whole numbers only: the wage of the month in cents
 * times 60 against the minimum wage in cents times the minutes worked. A month with minutes on a day
 * without a minimum wage or rule version is not judged but its days are named in `nichtHinterlegt`,
 * never computed with the value of another year (CLAUDE.md, "Never").
 */
export const mindestlohn = (
  monate: readonly Lohnmonat[],
  { ausnahmen = [] }: MindestlohnOptionen = {},
): LohnErgebnis<Pruefergebnis<MindestlohnBefund>> => {
  if (!monateGueltig(monate)) return { ok: false, grund: "ungueltig" };
  const befunde: MindestlohnBefund[] = [];
  const nichtHinterlegt: Tag[] = [];
  for (const monat of [...monate].sort((a, b) => a.monat.localeCompare(b.monat))) {
    if (ausgenommen(monat.monat, ausnahmen)) continue;
    const soll = mindestlohnMal60(monat);
    if (soll.nichtHinterlegt.length > 0) nichtHinterlegt.push(...soll.nichtHinterlegt);
    else befunde.push(...pruefeMonat(monat, soll));
  }
  return { ok: true, wert: { befunde, nichtHinterlegt: sortiert(nichtHinterlegt) } };
};
