import { regelversionAm } from "../jahreswerte/jahreswerte.ts";
import type { Tag } from "../kalender/tag.ts";

/**
 * The industries of § 2a Abs. 1 SchwarzArbG, in whose businesses § 17 Abs. 1 MiLoG asks every
 * employee's time to be recorded within seven days, and "andere" for every other business. Text on
 * gesetze-im-internet.de/schwarzarbg_2004/__2a.html, as of 20.11.2026 (Nr. 1 to 11).
 */
export const SCHWARZARBG_BRANCHEN = [
  "bau",
  "gaststaetten_beherbergung",
  "personenbefoerderung",
  "spedition_transport_logistik",
  "schausteller",
  "gebaeudereinigung",
  "messebau",
  "fleischwirtschaft",
  "prostitution",
  "wach_sicherheit",
  "friseur_kosmetik",
  "andere",
] as const;

export type SchwarzArbGBranche = (typeof SCHWARZARBG_BRANCHEN)[number];

/**
 * Who § 1 MiLoG does not cover (§ 22 MiLoG), set on the employee: Abs. 1 Satz 2 Nr. 1 to 4
 * (compulsory, orientation and accompanying internships, Einstiegsqualifizierung), Abs. 2 (under 18
 * without completed vocational training), Abs. 3 (apprentices, volunteers) and Abs. 4 (long-term
 * unemployed in their first six months). Text on gesetze-im-internet.de/milog/__22.html.
 */
export const MILOG_AUSNAHMEN = [
  "pflichtpraktikum",
  "orientierungspraktikum",
  "begleitpraktikum",
  "einstiegsqualifizierung",
  "jugendlich_ohne_abschluss",
  "auszubildend",
  "ehrenamt",
  "langzeitarbeitslos",
] as const;

export type MiLoGAusnahmegrund = (typeof MILOG_AUSNAHMEN)[number];

/**
 * The exceptions the law limits in time (§ 22 Abs. 1 Satz 2 Nr. 2 and 3: „bis zu drei Monaten“;
 * Abs. 4: „in den ersten sechs Monaten“): without an end they except nothing
 */
export const BEFRISTETE_AUSNAHMEN: readonly MiLoGAusnahmegrund[] = [
  "orientierungspraktikum",
  "begleitpraktikum",
  "langzeitarbeitslos",
];

/** The limits of § 17 Abs. 1 MiLoG and § 8 SGB IV (docs/regeln.md, R-13 and R-32) */
export type LohnGrenzen = {
  /** § 17 Abs. 1 Satz 1 MiLoG: „bis zum Ablauf des siebten … folgenden Kalendertages“ */
  aufzeichnungTage: number;
  /** docs/regeln.md, R-13: a Hinweis from the fifth day after the working day on */
  hinweisAbTag: number;
  /** § 8 Abs. 1b SGB IV: „in nicht mehr als zwei Kalendermonaten“ … */
  gelegentlichMonate: number;
  /** … „innerhalb des … Zeitjahres“, in months */
  zeitjahrMonate: number;
  /** … „um jeweils einen Betrag bis zur Höhe der Geringfügigkeitsgrenze“: at most this many times it */
  gelegentlichHoechstens: number;
};

/**
 * The limits per rule version (docs/plan.md, Entscheidungen, "Regeln"). Text of § 17 MiLoG and § 8
 * SGB IV on gesetze-im-internet.de, as of 20.11.2026.
 */
export const LOHN_GRENZEN: Readonly<Record<string, LohnGrenzen>> = {
  "2026-1": {
    aufzeichnungTage: 7,
    hinweisAbTag: 5,
    gelegentlichMonate: 2,
    zeitjahrMonate: 12,
    gelegentlichHoechstens: 2,
  },
};

/** The limits in force on a day; null before the first rule version ("nicht hinterlegt") */
export const lohnGrenzenAm = (tag: Tag): LohnGrenzen | null => {
  const version = regelversionAm(tag);
  return version.ok ? (LOHN_GRENZEN[version.wert] ?? null) : null;
};
