import type { Befund } from "../befund.ts";
import { minijobGrenzeAm } from "../jahreswerte/jahreswerte.ts";
import { ersterTag, type Monat, plusMonate } from "../kalender/monat.ts";
import type { Tag } from "../kalender/tag.ts";
import type { Pruefergebnis } from "../pruefung/typen.ts";
import { type LohnGrenzen, lohnGrenzenAm } from "./grenzen.ts";
import {
  arbeitsMinutenIm,
  centAbgerundet,
  centAufgerundet,
  type LohnErgebnis,
  type Lohnmonat,
  lohnMal60,
  monateGueltig,
  tageMitArbeit,
} from "./lohn.ts";

/**
 * R-32: the wage of a mini-job month is over the limit. `gelegentlich`: within § 8 Abs. 1b SGB IV
 * (at most two months in the Zeitjahr, each by at most the limit), allowed only if it was not
 * foreseeable; `schwankend`: more often or by more, but the months of the Zeitjahr stay within the
 * limit on average, allowed only if the fluctuation was part of the yearly estimate of the regular
 * wage; `grenze_ueberschritten`: neither holds, the job is no mini-job any more.
 * `monateUeber` counts the months over the limit in the Zeitjahr, this one included.
 */
export type MinijobBefund = Befund<"gelegentlich" | "schwankend" | "grenze_ueberschritten"> & {
  monat: Monat;
  lohnCent: number;
  grenzeCent: number;
  ueberCent: number;
  monateUeber: number;
};

/** A mini-job month as the rule reads it: its wage and its limit, times 60 */
type Stand = { monat: Lohnmonat; lohn: number; grenze: number };

/** § 1 Abs. 1 Satz 1 Nr. 1 SvEV: „soweit das Entgelt … mehr als 25 Euro für jede Stunde beträgt“ */
const SVEV_STUNDENLOHN_CENT = 2500;

/**
 * The part of the month's tax-free surcharges that is Arbeitsentgelt all the same, times 60: the
 * share of the hourly wage above 25 € (§ 1 Abs. 1 Satz 1 Nr. 1 SvEV), rounded up, never in favour of
 * the limit. The hourly wage is the wage of the month per hour worked (`grund` ÷ minutes); a month
 * without minutes has none, and a surcharge for work it does not record cannot be split.
 */
const steuerfreiAlsEntgeltMal60 = (monat: Lohnmonat, grund: number): number => {
  const steuerfrei = (monat.zuschlaege ?? [])
    .filter((zuschlag) => zuschlag.steuerfrei === true)
    .reduce((summe, zuschlag) => summe + zuschlag.cent, 0);
  const minuten = arbeitsMinutenIm(monat);
  const darueber = BigInt(grund) - BigInt(SVEV_STUNDENLOHN_CENT * minuten);
  if (steuerfrei === 0 || minuten === 0 || darueber <= 0n) return 0;
  const zaehler = BigInt(steuerfrei) * 60n * darueber;
  return Number((zaehler + BigInt(grund) - 1n) / BigInt(grund));
};

/**
 * Whether the wage counts as Arbeitsentgelt: surcharges free of tax under § 3b EStG do not, except
 * for the part on more than 25 € an hour
 */
const lohnFuerGrenze = (monat: Lohnmonat): number => {
  const grund = lohnMal60(monat, () => false);
  return (
    lohnMal60(monat, (zuschlag) => zuschlag.steuerfrei !== true) +
    steuerfreiAlsEntgeltMal60(monat, grund)
  );
};

/**
 * A mini-job month with its limit, or null when its year has none ("nicht hinterlegt"). A month of
 * the Zeitjahr needs only its limit; the month judged also needs its rule version.
 */
const standAus = (monat: Lohnmonat): Stand | null => {
  const grenze = minijobGrenzeAm(ersterTag(monat.monat));
  if (!grenze.ok) return null;
  return { monat, lohn: lohnFuerGrenze(monat), grenze: grenze.wert * 60 };
};

const befund = (stand: Stand, art: MinijobBefund["art"], monateUeber: number): MinijobBefund => ({
  regel: "R-32",
  norm: art === "gelegentlich" ? "§ 8 Abs. 1b SGB IV" : "§ 8 Abs. 1 Nr. 1 SGB IV",
  schwere: art === "grenze_ueberschritten" ? "verstoss" : "hinweis",
  art,
  tage: tageMitArbeit(stand.monat),
  monat: stand.monat.monat,
  lohnCent: centAbgerundet(stand.lohn),
  grenzeCent: stand.grenze / 60,
  ueberCent: centAufgerundet(stand.lohn - stand.grenze),
  monateUeber,
});

/** The verdict on a month over the limit, from the mini-job months of its Zeitjahr */
const urteil = (stand: Stand, zeitjahr: readonly Stand[], grenzen: LohnGrenzen): MinijobBefund => {
  const ueber = zeitjahr.filter((eintrag) => eintrag.lohn > eintrag.grenze);
  const gelegentlich =
    ueber.length <= grenzen.gelegentlichMonate &&
    ueber.every((eintrag) => eintrag.lohn <= eintrag.grenze * grenzen.gelegentlichHoechstens);
  if (gelegentlich) return befund(stand, "gelegentlich", ueber.length);
  const summe = (wert: (eintrag: Stand) => number) =>
    zeitjahr.reduce((teil, eintrag) => teil + wert(eintrag), 0);
  const imSchnitt = summe((eintrag) => eintrag.lohn) <= summe((eintrag) => eintrag.grenze);
  return befund(stand, imSchnitt ? "schwankend" : "grenze_ueberschritten", ueber.length);
};

/** The mini-job months of the Zeitjahr ending with `monat`; null if one of them has no limit */
const zeitjahrBis = (
  monat: Monat,
  minijobs: ReadonlyMap<Monat, Lohnmonat>,
  grenzen: LohnGrenzen,
): Stand[] | null => {
  const staende: Stand[] = [];
  for (let zurueck = grenzen.zeitjahrMonate - 1; zurueck >= 0; zurueck--) {
    const eintrag = minijobs.get(plusMonate(monat, -zurueck));
    if (eintrag === undefined) continue;
    const stand = standAus(eintrag);
    if (stand === null) return null;
    staende.push(stand);
  }
  return staende;
};

/**
 * § 8 Abs. 1 Nr. 1, Abs. 1a and 1b SGB IV per mini-job month (docs/regeln.md, R-32): the wage counted
 * as Arbeitsentgelt against the limit of its year (S-104). The Zeitjahr is the month and the eleven
 * before it (Geringfügigkeits-Richtlinien vom 14.12.2023: it ends with the month of the overrun), so
 * pass those months too. A month without limit or rule version, or over the limit with a month
 * without limit in its Zeitjahr, is "nicht hinterlegt", named by its first day.
 */
export const minijobGrenze = (
  monate: readonly Lohnmonat[],
): LohnErgebnis<Pruefergebnis<MinijobBefund>> => {
  if (!monateGueltig(monate)) return { ok: false, grund: "ungueltig" };
  const minijobs = new Map(monate.filter((m) => m.minijob).map((m) => [m.monat, m] as const));
  const befunde: MinijobBefund[] = [];
  const nichtHinterlegt: Tag[] = [];
  for (const monat of [...minijobs.keys()].sort()) {
    const grenzen = lohnGrenzenAm(ersterTag(monat));
    const stand = standAus(minijobs.get(monat) as Lohnmonat);
    if (grenzen === null || stand === null) {
      nichtHinterlegt.push(ersterTag(monat));
      continue;
    }
    if (stand.lohn <= stand.grenze) continue;
    const zeitjahr = zeitjahrBis(monat, minijobs, grenzen);
    if (zeitjahr === null) nichtHinterlegt.push(ersterTag(monat));
    else befunde.push(urteil(stand, zeitjahr, grenzen));
  }
  return { ok: true, wert: { befunde, nichtHinterlegt } };
};
