import type { Angaben } from "./angaben.ts";

/*
 * What the server reads from the live state of one business for its Verfahrensdokumentation
 * (S-902). Plain data, so the document is a pure function of it and the day: the same state gives
 * the same Markdown and the same PDF. It holds no names or e-mail addresses of members, no tokens
 * and no personnel numbers, only counts and what the business set up.
 */

export type Module = {
  arbeitszeit: boolean;
  dienstplan: boolean;
  projektzeit: boolean;
  terminal: boolean;
};

export type DokuRolle = {
  /** The role's id in Soll (`inhaber`, `planer`, …) */
  rolle: string;
  mitglieder: number;
  /** The rights of the role, as `auth/rollen.ts` grants them */
  rechte: string[];
};

export type DokuTerminal = {
  name: string;
  gekoppelt: boolean;
  widerrufen: boolean;
  /** The tablet holds a key for its queue without network (S-803) */
  offline: boolean;
};

export type DokuStandDaten = {
  version: string;
  betrieb: { name: string; land: string | null };
  module: Module;
  standorte: { name: string; land: string; regionen: string[] }[];
  rollen: DokuRolle[];
  /** Personal access tokens that have not expired (S-607) */
  apiZugaenge: number;
  kette: {
    /** "Nr. 1234 · <SHA-256>", null while the chain has no link */
    pruefwert: string | null;
    glieder: number;
    /** Findings of the check of chain, contents, head and rows while the document was made */
    befunde: number;
  };
  aufbewahrung: {
    /** Closed months of persons (one per person and month) */
    abgeschlossen: number;
    /** Months removed after their period (S-901), by years of the period */
    ausgesondert: { zweiJahre: number; achtJahre: number };
  };
  terminal: {
    terminals: DokuTerminal[];
    karten: { uid: number; ntag424: number };
    ausweise: number;
    pins: number;
  };
  /** The DATEV mapping (S-308): set up at all, consultant and client number given, counts */
  datev: { eingerichtet: boolean; nummern: boolean; lohnarten: number; personalnummern: number };
  /** The address of the business's Haben (S-606), never its token; null without one */
  haben: { adresse: string } | null;
  /** Imports from other tools taken over (S-701): how many and the ids of their tools */
  importe: { anzahl: number; werkzeuge: string[] };
  angaben: Angaben;
  /** Each saved change of the statements: its link in the chain and when */
  angabenAenderungen: { seq: number; zeitpunkt: number }[];
};
