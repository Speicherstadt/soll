import { regelversionAm } from "../jahreswerte/jahreswerte.ts";
import type { Tag } from "../kalender/tag.ts";

/**
 * The industries the JArbSchG names for longer shifts (§ 12), later or earlier hours (§ 14 Abs. 2
 * and 3) and work on Saturdays and Sundays (§ 16 Abs. 2, § 17 Abs. 2), and "andere" for every other
 * business. The setting lives on the business (S-303); until it is known, "andere" applies: the
 * strict limits.
 */
export const JUGEND_BRANCHEN = [
  "gaststaetten",
  "schausteller",
  "landwirtschaft_tierhaltung",
  "baeckerei",
  "konditorei",
  "bergbau_unter_tage",
  "andere",
] as const;

export type JugendBranche = (typeof JUGEND_BRANCHEN)[number];

/** A span of the wall clock in minutes after 0:00 in which work is allowed */
export type Arbeitsfenster = { ab: number; bis: number };

/** The limits of §§ 2, 8, 11 to 18 JArbSchG in whole minutes (docs/regeln.md, R-15 to R-20) */
export type JugendGrenzen = {
  /** § 2 Abs. 2: Jugendlicher ist, „wer 15, aber noch nicht 18 Jahre alt ist“ */
  volljaehrig: number;
  /** § 8 Abs. 1: „nicht mehr als acht Stunden täglich und nicht mehr als 40 Stunden wöchentlich“ */
  taeglich: number;
  woechentlich: number;
  /** § 8 Abs. 2a: „an den übrigen Werktagen derselben Woche achteinhalb Stunden“ */
  taeglichAusgleich: number;
  /** § 4 Abs. 4 Satz 2: time lost on a holiday, counted with the daily limit until the Soll is known */
  feiertagsausfall: number;
  /** § 11 Abs. 1: the break owed when the working time is more than `ab` minutes, highest first */
  pausen: readonly { ab: number; minuten: number }[];
  /** § 11 Abs. 2 Satz 1: „frühestens eine Stunde nach Beginn und spätestens eine Stunde vor Ende“ */
  pauseAbstand: number;
  /** § 11 Abs. 2 Satz 2: „Länger als viereinhalb Stunden hintereinander … nicht ohne Ruhepause“ */
  hintereinander: number;
  /** § 12: Schichtzeit 10 hours, 11 in the industries and on the sites named, 8 under ground */
  schichtzeit: number;
  schichtzeitLang: number;
  schichtzeitLangIn: readonly JugendBranche[];
  schichtzeitBergbau: number;
  /** § 13: „ununterbrochene Freizeit von mindestens 12 Stunden“ */
  freizeit: number;
  /** § 14 Abs. 1: „nur in der Zeit von 6 bis 20 Uhr“ */
  arbeitsfenster: Arbeitsfenster;
  /** § 14 Abs. 2 and 3: later or earlier hours from an age on, by industry */
  fensterAb: readonly { alter: number; branche: JugendBranche; fenster: Partial<Arbeitsfenster> }[];
  /** § 14 Abs. 2 Nr. 2: „in mehrschichtigen Betrieben bis 23 Uhr“, über 16 Jahre */
  mehrschichtigAb: { alter: number; bis: number };
  /** § 14 Abs. 2 Nr. 3: Landwirtschaft „ab 5 Uhr oder bis 21 Uhr“, über 16 Jahre */
  landwirtschaftAb: { alter: number; ab: number; bis: number };
  /** § 15: „nur an fünf Tagen in der Woche“ */
  arbeitstageJeWoche: number;
  /** § 16 Abs. 2 Nr. 1 to 11 and § 17 Abs. 2 Nr. 1 to 8, and the numbers an industry brings */
  samstagNummern: number;
  sonntagNummern: number;
  samstagIn: Partial<Record<JugendBranche, number>>;
  sonntagIn: Partial<Record<JugendBranche, number>>;
  /** § 17 Abs. 2 Satz 2: „mindestens zwei Sonntage im Monat müssen beschäftigungsfrei bleiben“ */
  freieSonntage: number;
  /** § 18 Abs. 1: „Am 24. und 31. Dezember nach 14 Uhr“ */
  dezemberBis: number;
  dezemberTage: readonly string[];
  /** § 18 Abs. 2: „ausgenommen am 25. Dezember, am 1. Januar, am ersten Osterfeiertag und am 1. Mai“ */
  nieTage: readonly string[];
};

const STUNDE = 60;

/**
 * The limits per rule version (docs/plan.md, Entscheidungen, "Regeln"): a reform adds a version and
 * leaves this one for the days before it. Text of the JArbSchG on gesetze-im-internet.de/jarbschg/,
 * as of 20.11.2026.
 */
export const JUGEND_GRENZEN: Readonly<Record<string, JugendGrenzen>> = {
  "2026-1": {
    volljaehrig: 18,
    taeglich: 8 * STUNDE,
    woechentlich: 40 * STUNDE,
    taeglichAusgleich: 8 * STUNDE + 30,
    feiertagsausfall: 8 * STUNDE,
    pausen: [
      { ab: 6 * STUNDE, minuten: 60 },
      { ab: 4 * STUNDE + 30, minuten: 30 },
    ],
    pauseAbstand: STUNDE,
    hintereinander: 4 * STUNDE + 30,
    schichtzeit: 10 * STUNDE,
    schichtzeitLang: 11 * STUNDE,
    schichtzeitLangIn: ["gaststaetten", "landwirtschaft_tierhaltung"],
    schichtzeitBergbau: 8 * STUNDE,
    freizeit: 12 * STUNDE,
    arbeitsfenster: { ab: 6 * STUNDE, bis: 20 * STUNDE },
    fensterAb: [
      { alter: 16, branche: "gaststaetten", fenster: { bis: 22 * STUNDE } },
      { alter: 16, branche: "schausteller", fenster: { bis: 22 * STUNDE } },
      { alter: 16, branche: "baeckerei", fenster: { ab: 5 * STUNDE } },
      { alter: 16, branche: "konditorei", fenster: { ab: 5 * STUNDE } },
      { alter: 17, branche: "baeckerei", fenster: { ab: 4 * STUNDE } },
    ],
    mehrschichtigAb: { alter: 16, bis: 23 * STUNDE },
    landwirtschaftAb: { alter: 16, ab: 5 * STUNDE, bis: 21 * STUNDE },
    arbeitstageJeWoche: 5,
    samstagNummern: 11,
    sonntagNummern: 8,
    samstagIn: {
      gaststaetten: 6,
      schausteller: 6,
      landwirtschaft_tierhaltung: 4,
      baeckerei: 2,
      konditorei: 2,
    },
    sonntagIn: { gaststaetten: 8, schausteller: 4 },
    freieSonntage: 2,
    dezemberBis: 14 * STUNDE,
    dezemberTage: ["12-24", "12-31"],
    nieTage: ["12-25", "01-01", "05-01"],
  },
};

/** The limits in force on a day; null before the first rule version ("nicht hinterlegt") */
export const jugendGrenzenAm = (tag: Tag): JugendGrenzen | null => {
  const version = regelversionAm(tag);
  return version.ok ? (JUGEND_GRENZEN[version.wert] ?? null) : null;
};
