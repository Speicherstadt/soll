import { regelversionAm } from "../jahreswerte/jahreswerte.ts";
import type { Tag } from "../kalender/tag.ts";
import type { Uhrzeitspanne } from "../pruefung-nacht-sonntag/grenzen.ts";

/** The limits of §§ 3 to 6 MuSchG in whole minutes and days (docs/regeln.md, R-21) */
export type MutterschutzGrenzen = {
  /** § 4 Abs. 1 Satz 1 and 2: „die 18 Jahre oder älter ist“ */
  volljaehrig: number;
  /** § 4 Abs. 1 Satz 1: „über achteinhalb Stunden täglich oder über 90 Stunden in der Doppelwoche“ */
  taeglich: number;
  doppelwoche: number;
  /** § 4 Abs. 1 Satz 2, unter 18 Jahren: „über acht Stunden täglich oder über 80 Stunden“ */
  taeglichMinderjaehrig: number;
  doppelwocheMinderjaehrig: number;
  /** § 4 Abs. 2: „ununterbrochene Ruhezeit von mindestens elf Stunden“ */
  ruhezeit: number;
  /** § 5 Abs. 1 Satz 1: „nicht zwischen 20 Uhr und 6 Uhr“; Satz 2 with § 28: „bis 22 Uhr“ */
  nacht: Uhrzeitspanne;
  nachtGenehmigt: Uhrzeitspanne;
  /** § 6 Abs. 1 Satz 2 Nr. 3: „im Anschluss an eine ununterbrochene Nachtruhezeit von mindestens elf Stunden“ */
  ersatzruheNacht: number;
  /** § 3 Abs. 1: „in den letzten sechs Wochen vor der Entbindung“, in days */
  schutzfristVor: number;
  /** § 3 Abs. 2: „bis zum Ablauf von acht Wochen nach der Entbindung“, twelve in the cases of Satz 2 */
  schutzfristNach: number;
  schutzfristNachVerlaengert: number;
  /** § 3 Abs. 5 Satz 1: after a Fehlgeburt from the week of pregnancy named, highest first */
  fehlgeburt: readonly { abWoche: number; tage: number }[];
};

/**
 * The limits per rule version (docs/plan.md, Entscheidungen, "Regeln"). Text of the MuSchG on
 * gesetze-im-internet.de/muschg_2018/, as of 20.11.2026 (§ 3 Abs. 5 in force since 1.6.2025).
 */
export const MUTTERSCHUTZ_GRENZEN: Readonly<Record<string, MutterschutzGrenzen>> = {
  "2026-1": {
    volljaehrig: 18,
    taeglich: 8 * 60 + 30,
    doppelwoche: 90 * 60,
    taeglichMinderjaehrig: 8 * 60,
    doppelwocheMinderjaehrig: 80 * 60,
    ruhezeit: 11 * 60,
    nacht: { von: 20 * 60, bis: 6 * 60 },
    nachtGenehmigt: { von: 22 * 60, bis: 6 * 60 },
    ersatzruheNacht: 11 * 60,
    schutzfristVor: 6 * 7,
    schutzfristNach: 8 * 7,
    schutzfristNachVerlaengert: 12 * 7,
    fehlgeburt: [
      { abWoche: 20, tage: 8 * 7 },
      { abWoche: 17, tage: 6 * 7 },
      { abWoche: 13, tage: 2 * 7 },
    ],
  },
};

/** The limits in force on a day; null before the first rule version ("nicht hinterlegt") */
export const mutterschutzGrenzenAm = (tag: Tag): MutterschutzGrenzen | null => {
  const version = regelversionAm(tag);
  return version.ok ? (MUTTERSCHUTZ_GRENZEN[version.wert] ?? null) : null;
};
