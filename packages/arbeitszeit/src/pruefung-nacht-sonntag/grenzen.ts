import { regelversionAm } from "../jahreswerte/jahreswerte.ts";
import type { Tag } from "../kalender/tag.ts";

/** A span of the wall clock in minutes after 0:00, from one day into the next */
export type Uhrzeitspanne = { von: number; bis: number };

/** The limits of §§ 2, 6, 9 to 11 ArbZG in whole minutes and days (docs/regeln.md, R-06 to R-09) */
export type NachtSonntagGrenzen = {
  /** § 2 Abs. 3: „die Zeit von 23 bis 6 Uhr“ … */
  nachtzeit: Uhrzeitspanne;
  /** … „in Bäckereien und Konditoreien die Zeit von 22 bis 5 Uhr“ */
  nachtzeitBaeckerei: Uhrzeitspanne;
  /** § 2 Abs. 4: „mehr als zwei Stunden der Nachtzeit“ */
  nachtarbeitUeber: number;
  /** § 2 Abs. 5 Nr. 2: „an mindestens 48 Tagen im Kalenderjahr“ */
  nachtarbeitnehmerAb: number;
  /** docs/regeln.md, R-06: the Hinweis „bald Nachtarbeitnehmer“ on this Nachtarbeitstag */
  baldNachtarbeitnehmer: number;
  /** § 6 Abs. 2 Satz 1: „acht Stunden nicht überschreiten“; Satz 2: „auf bis zu zehn Stunden“ */
  werktaeglich: number;
  verlaengert: number;
  /** § 6 Abs. 2 Satz 2: „innerhalb von einem Kalendermonat oder innerhalb von vier Wochen“, in days */
  vierWochen: number;
  /** § 9 Abs. 2: „um bis zu sechs Stunden vor- oder zurückverlegt“ */
  verschiebungHoechstens: number;
  /** § 10 Abs. 3: Bäckereien und Konditoreien „für bis zu drei Stunden“ */
  baeckereiSonntag: number;
  /** § 11 Abs. 1: „Mindestens 15 Sonntage im Jahr müssen beschäftigungsfrei bleiben.“ */
  freieSonntage: number;
  /** § 11 Abs. 3: Ersatzruhetag in einem Zeitraum von zwei Wochen (Sonntag) oder acht (Feiertag), in days */
  ersatzSonntag: number;
  ersatzFeiertag: number;
};

/**
 * The limits per rule version (docs/plan.md, Entscheidungen, "Regeln"): a reform adds a version and
 * leaves this one for the days before it. Text of §§ 2, 6, 9 to 11 ArbZG on
 * gesetze-im-internet.de/arbzg/, as of 20.11.2026.
 */
export const NACHT_SONNTAG_GRENZEN: Readonly<Record<string, NachtSonntagGrenzen>> = {
  "2026-1": {
    nachtzeit: { von: 23 * 60, bis: 6 * 60 },
    nachtzeitBaeckerei: { von: 22 * 60, bis: 5 * 60 },
    nachtarbeitUeber: 2 * 60,
    nachtarbeitnehmerAb: 48,
    baldNachtarbeitnehmer: 40,
    werktaeglich: 8 * 60,
    verlaengert: 10 * 60,
    vierWochen: 28,
    verschiebungHoechstens: 6 * 60,
    baeckereiSonntag: 3 * 60,
    freieSonntage: 15,
    ersatzSonntag: 14,
    ersatzFeiertag: 56,
  },
};

/** The limits in force on a day; null before the first rule version ("nicht hinterlegt") */
export const nachtSonntagGrenzenAm = (tag: Tag): NachtSonntagGrenzen | null => {
  const version = regelversionAm(tag);
  return version.ok ? (NACHT_SONNTAG_GRENZEN[version.wert] ?? null) : null;
};
