import { type Monat, type Tag, tageImMonat, tagInBerlin } from "@soll/arbeitszeit";
import type { Lohnmodell } from "@soll/export";

/*
 * The retention period of a closed month (S-901, docs/plan.md "Aufbewahrung je Monatsabschluss"):
 * pure functions, no database.
 */

/** 2 years as a record of working time, 8 years as a voucher of payroll */
export type Aufbewahrungsjahre = 2 | 8;

/** The model in force on a day: the latest section on or before it */
const modellAm = (modelle: readonly Lohnmodell[], tag: Tag): Lohnmodell | undefined =>
  modelle.filter((modell) => modell.ab <= tag).at(-1);

/**
 * Whether payroll posts something from the day's times (docs/plan.md, "Posten des DATEV-Exports"):
 * hours for an hourly wage and a mini-job, amounts for surcharges; a monthly wage is no posting.
 * A day without a model counts as posted, as nothing shows that it is not.
 */
const gebucht = (modell: Lohnmodell | undefined): boolean =>
  modell === undefined ||
  modell.lohnArt === "stunde" ||
  modell.minijob ||
  Object.values(modell.zuschlagssaetze).some((satz) => (satz ?? 0) > 0);

/**
 * 8 years when the month is a voucher of payroll on any day (§ 147 Abs. 1 Nr. 4, Abs. 3 Satz 1 AO,
 * § 257 Abs. 1 Nr. 4, Abs. 4 HGB, 8 years since 1 January 2025), else 2 years as the record of
 * working time (§ 16 Abs. 2 ArbZG). The days of the counter-entries booked in the month count too:
 * payroll posts each under the model of the day it corrects. The 6 years of other documents (§ 147 Abs. 3 AO) and of the
 * payroll account (§ 41 Abs. 1 EStG) do not apply: the payroll account is kept by the payroll office,
 * and a month that payroll did not post from is no tax document of the business.
 */
export const aufbewahrungsjahre = (
  modelle: readonly Lohnmodell[],
  monat: Monat,
  korrigierteTage: readonly Tag[] = [],
): Aufbewahrungsjahre =>
  [...tageImMonat(monat), ...korrigierteTage].some((tag) => gebucht(modellAm(modelle, tag)))
    ? 8
    : 2;

/**
 * The first day the content may be removed: the period starts with the end of the calendar year the
 * month was closed in, when the voucher came into being (§ 147 Abs. 4 AO), and ends with the end of
 * the last of its years
 */
export const aussonderbarAb = (abgeschlossenAm: number, jahre: Aufbewahrungsjahre): Tag =>
  `${Number(tagInBerlin(abgeschlossenAm).slice(0, 4)) + jahre + 1}-01-01` as Tag;
