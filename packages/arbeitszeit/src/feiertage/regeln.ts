import type { Land, Region } from "./laender.ts";

/** How a holiday's date follows from the year */
export type Termin =
  | { art: "fest"; monat: number; tag: number }
  | { art: "ostern"; abstand: number }
  /** The Wednesday before 23 November */
  | { art: "buss_und_bettag" };

export type FeiertagsRegel = {
  schluessel: string;
  name: string;
  termin: Termin;
  /** The Länder where it holds, or every Land */
  laender: readonly Land[] | "alle";
  /** Only in municipalities of these regions (within `laender`) */
  regionen?: readonly Region[];
  /** First and last year it holds, inclusive */
  ab?: number;
  bis?: number;
};

const fest = (monat: number, tag: number): Termin => ({ art: "fest", monat, tag });
const ostern = (abstand: number): Termin => ({ art: "ostern", abstand });

/**
 * The holidays of the 16 Länder as data (docs/plan.md, "Regeln als Daten"). Years before 1995, when
 * Buß- und Bettag ended outside Saxony, are not covered (FRUEHESTES_JAHR).
 */
export const FEIERTAGE: readonly FeiertagsRegel[] = [
  { schluessel: "neujahr", name: "Neujahr", termin: fest(1, 1), laender: "alle" },
  {
    schluessel: "heilige_drei_koenige",
    name: "Heilige Drei Könige",
    termin: fest(1, 6),
    laender: ["BW", "BY", "ST"],
  },
  {
    schluessel: "frauentag",
    name: "Internationaler Frauentag",
    termin: fest(3, 8),
    laender: ["BE"],
    ab: 2019,
  },
  {
    schluessel: "frauentag",
    name: "Internationaler Frauentag",
    termin: fest(3, 8),
    laender: ["MV"],
    ab: 2023,
  },
  { schluessel: "karfreitag", name: "Karfreitag", termin: ostern(-2), laender: "alle" },
  { schluessel: "ostersonntag", name: "Ostersonntag", termin: ostern(0), laender: ["BB"] },
  { schluessel: "ostermontag", name: "Ostermontag", termin: ostern(1), laender: "alle" },
  { schluessel: "tag_der_arbeit", name: "Tag der Arbeit", termin: fest(5, 1), laender: "alle" },
  {
    schluessel: "tag_der_befreiung",
    name: "Tag der Befreiung",
    termin: fest(5, 8),
    laender: ["BE"],
    ab: 2020,
    bis: 2020,
  },
  {
    schluessel: "tag_der_befreiung",
    name: "Tag der Befreiung",
    termin: fest(5, 8),
    laender: ["BE"],
    ab: 2025,
    bis: 2025,
  },
  {
    schluessel: "christi_himmelfahrt",
    name: "Christi Himmelfahrt",
    termin: ostern(39),
    laender: "alle",
  },
  { schluessel: "pfingstsonntag", name: "Pfingstsonntag", termin: ostern(49), laender: ["BB"] },
  { schluessel: "pfingstmontag", name: "Pfingstmontag", termin: ostern(50), laender: "alle" },
  {
    schluessel: "jahrestag_17_juni_1953",
    name: "75. Jahrestag des Aufstandes vom 17. Juni 1953",
    termin: fest(6, 17),
    laender: ["BE"],
    ab: 2028,
    bis: 2028,
  },
  {
    schluessel: "fronleichnam",
    name: "Fronleichnam",
    termin: ostern(60),
    laender: ["BW", "BY", "HE", "NW", "RP", "SL"],
  },
  {
    schluessel: "fronleichnam",
    name: "Fronleichnam",
    termin: ostern(60),
    laender: ["SN", "TH"],
    regionen: ["fronleichnam_sachsen", "fronleichnam_thueringen"],
  },
  {
    schluessel: "friedensfest",
    name: "Augsburger Friedensfest",
    termin: fest(8, 8),
    laender: ["BY"],
    regionen: ["augsburg"],
  },
  {
    schluessel: "mariae_himmelfahrt",
    name: "Mariä Himmelfahrt",
    termin: fest(8, 15),
    laender: ["SL"],
  },
  {
    schluessel: "mariae_himmelfahrt",
    name: "Mariä Himmelfahrt",
    termin: fest(8, 15),
    laender: ["BY"],
    regionen: ["katholisch"],
  },
  {
    schluessel: "weltkindertag",
    name: "Weltkindertag",
    termin: fest(9, 20),
    laender: ["TH"],
    ab: 2019,
  },
  {
    schluessel: "tag_der_deutschen_einheit",
    name: "Tag der Deutschen Einheit",
    termin: fest(10, 3),
    laender: "alle",
  },
  {
    schluessel: "reformationstag",
    name: "Reformationstag",
    termin: fest(10, 31),
    laender: ["BB", "MV", "SN", "ST", "TH"],
  },
  // 2017 as a one-off in every Land (500 years of the Reformation), from 2018 for good in these four
  {
    schluessel: "reformationstag",
    name: "Reformationstag",
    termin: fest(10, 31),
    laender: ["HB", "HH", "NI", "SH"],
    ab: 2017,
  },
  {
    schluessel: "reformationstag",
    name: "Reformationstag",
    termin: fest(10, 31),
    laender: ["BW", "BY", "BE", "HE", "NW", "RP", "SL"],
    ab: 2017,
    bis: 2017,
  },
  {
    schluessel: "allerheiligen",
    name: "Allerheiligen",
    termin: fest(11, 1),
    laender: ["BW", "BY", "NW", "RP", "SL"],
  },
  {
    schluessel: "buss_und_bettag",
    name: "Buß- und Bettag",
    termin: { art: "buss_und_bettag" },
    laender: ["SN"],
  },
  {
    schluessel: "erster_weihnachtstag",
    name: "1. Weihnachtstag",
    termin: fest(12, 25),
    laender: "alle",
  },
  {
    schluessel: "zweiter_weihnachtstag",
    name: "2. Weihnachtstag",
    termin: fest(12, 26),
    laender: "alle",
  },
];

/** The first year whose holidays the data covers */
export const FRUEHESTES_JAHR = 1995;
