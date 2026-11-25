/*
 * The Verfahrensdokumentation as GET /api/v1/verfahrensdoku returns it (S-902): the document made
 * from the business's state and the statements only the business can make.
 */

/** The fields the owner fills in, in the order of the form (packages/export, ANGABEN_FELDER) */
export const FELDER = [
  "rechtsform",
  "anschrift",
  "verantwortlich",
  "aufbewahrungsort",
  "serverbetrieb",
  "datensicherung",
  "schluesselablage",
] as const;

export type Feld = (typeof FELDER)[number];

/** The longest text each field takes, as the server checks it */
export const LAENGE: Record<Feld, number> = {
  rechtsform: 100,
  anschrift: 1000,
  verantwortlich: 1000,
  aufbewahrungsort: 2000,
  serverbetrieb: 5000,
  datensicherung: 5000,
  schluesselablage: 2000,
};

export const EIGENE = { anzahl: 20, titel: 200, text: 20000 } as const;

export type EigenerAbschnitt = { titel: string; text: string };

export type Angaben = Record<Feld, string> & { eigene: EigenerAbschnitt[] };

export type Abschnitt = { titel: string; absaetze: string[]; liste?: string[]; luecken?: string[] };

export type Dokument = {
  titel: string;
  stand: { datum: string; programm: string; version: string; pruefwert: string | null };
  abschnitte: Abschnitt[];
  luecken: number;
  vollstaendig: boolean;
};

export type VerfahrensdokuAnsicht = { dokument: Dokument; angaben: Angaben };
