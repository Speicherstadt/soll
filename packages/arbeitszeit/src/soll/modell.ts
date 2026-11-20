import { istTag, type Tag, wochentag } from "../kalender/tag.ts";
import type { Modellabschnitt, Wochenminuten } from "./typen.ts";

const MINUTEN_AM_TAG = 1440;

/** The minutes of a weekday in a model, Monday first */
export const minutenAmWochentag = (sollMinuten: Wochenminuten, tag: Tag): number =>
  sollMinuten[(wochentag(tag) + 6) % 7] ?? 0;

/** The model in force on a day: the latest that starts on or before it; null before the first */
export const modellAm = <M extends Modellabschnitt>(modelle: readonly M[], tag: Tag): M | null =>
  modelle.reduce<M | null>(
    (bisher, modell) =>
      modell.ab <= tag && (bisher === null || modell.ab >= bisher.ab) ? modell : bisher,
    null,
  );

/**
 * The working days per week of a model: as entered, else the weekdays with minutes. § 3 Abs. 1 BUrlG
 * and § 208 Abs. 1 SGB IX scale with them.
 */
export const arbeitstageJeWoche = (modell: Modellabschnitt): number =>
  modell.arbeitstageJeWoche ?? modell.sollMinuten.filter((minuten) => minuten > 0).length;

const ganzzahlig = (zahl: unknown, von: number, bis: number): boolean =>
  Number.isInteger(zahl) && (zahl as number) >= von && (zahl as number) <= bis;

/** Seven whole minutes of at most a day, a real start day, each start once; leave never negative */
export const modelleGueltig = (modelle: readonly Modellabschnitt[]): boolean =>
  new Set(modelle.map((modell) => modell.ab)).size === modelle.length &&
  modelle.every(
    (modell) =>
      istTag(modell.ab) &&
      modell.sollMinuten.length === 7 &&
      modell.sollMinuten.every((minuten) => ganzzahlig(minuten, 0, MINUTEN_AM_TAG)) &&
      (modell.urlaubHalbtage == null || ganzzahlig(modell.urlaubHalbtage, 0, 2 * 366)) &&
      (modell.arbeitstageJeWoche == null || ganzzahlig(modell.arbeitstageJeWoche, 0, 7)),
  );
