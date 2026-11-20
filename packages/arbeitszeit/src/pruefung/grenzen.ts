import { regelversionAm } from "../jahreswerte/jahreswerte.ts";
import type { Tag } from "../kalender/tag.ts";

/**
 * The industries of § 5 Abs. 2 ArbZG, which may shorten the rest to 10 hours, and "andere" for every
 * other business. The setting lives on the business (S-303); until it is known, "andere" applies:
 * no shortening, the strict limit.
 */
export const BRANCHEN = [
  "krankenhaus_pflege",
  "gastronomie_beherbergung",
  "verkehr",
  "rundfunk",
  "landwirtschaft_tierhaltung",
  "andere",
] as const;

export type Branche = (typeof BRANCHEN)[number];

/** The limits of §§ 3 to 5 ArbZG in whole minutes (docs/regeln.md, R-02 to R-05) */
export type ArbzgGrenzen = {
  /** § 3 Satz 1: „acht Stunden nicht überschreiten“ */
  werktaeglich: number;
  /** § 3 Satz 2: „auf bis zu zehn Stunden“ */
  verlaengert: number;
  /** § 3 Satz 2: „innerhalb von sechs Kalendermonaten oder innerhalb von 24 Wochen“ */
  ausgleichMonate: number;
  ausgleichWochen: number;
  /** § 4 Satz 1: the break owed when the working time is more than `ab` minutes, highest first */
  pausen: readonly { ab: number; minuten: number }[];
  /** § 4 Satz 3: „Länger als sechs Stunden hintereinander … nicht ohne Ruhepause“ */
  hintereinander: number;
  /** § 5 Abs. 1: „mindestens elf Stunden“ */
  ruhezeit: number;
  /** § 5 Abs. 2: „um bis zu eine Stunde verkürzt“ in these industries … */
  ruhezeitVerkuerzt: number;
  verkuerzbar: readonly Branche[];
  /** … „durch Verlängerung einer anderen Ruhezeit auf mindestens zwölf Stunden“ */
  ruhezeitAusgleich: number;
  /** … „innerhalb eines Kalendermonats oder innerhalb von vier Wochen“, in days */
  ausgleichVierWochen: number;
};

/**
 * The limits per rule version (docs/plan.md, Entscheidungen, "Regeln"): a reform of the ArbZG adds a
 * version with its own limits and leaves this one for the days before it. Text of §§ 3 to 5 ArbZG on
 * gesetze-im-internet.de/arbzg/, as of 20.11.2026.
 */
export const ARBZG_GRENZEN: Readonly<Record<string, ArbzgGrenzen>> = {
  "2026-1": {
    werktaeglich: 8 * 60,
    verlaengert: 10 * 60,
    ausgleichMonate: 6,
    ausgleichWochen: 24,
    pausen: [
      { ab: 9 * 60, minuten: 45 },
      { ab: 6 * 60, minuten: 30 },
    ],
    hintereinander: 6 * 60,
    ruhezeit: 11 * 60,
    ruhezeitVerkuerzt: 10 * 60,
    verkuerzbar: [
      "krankenhaus_pflege",
      "gastronomie_beherbergung",
      "verkehr",
      "rundfunk",
      "landwirtschaft_tierhaltung",
    ],
    ruhezeitAusgleich: 12 * 60,
    ausgleichVierWochen: 28,
  },
};

/** The limits in force on a working day; null before the first rule version ("nicht hinterlegt") */
export const arbzgGrenzenAm = (tag: Tag): ArbzgGrenzen | null => {
  const version = regelversionAm(tag);
  return version.ok ? (ARBZG_GRENZEN[version.wert] ?? null) : null;
};
