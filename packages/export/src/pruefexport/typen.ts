/*
 * What the Prüfexport carries (S-309): a person's working days in a period as an authority asks for
 * them (§ 16 Abs. 2 ArbZG, § 17 Abs. 1 MiLoG), with the Prüfwert of each closed month. Whole minutes,
 * instants in UTC milliseconds, days as YYYY-MM-DD in Europe/Berlin.
 */

export type Stempelart = "kommen" | "gehen" | "pause_beginn" | "pause_ende";

/** A change by hand to a stamp of the day: what before and after, why, who and when */
export type PruefAenderung = {
  aktion: "nachgetragen" | "geaendert" | "entfernt";
  vorher: { art: Stempelart; zeitpunkt: number } | null;
  nachher: { art: Stempelart; zeitpunkt: number } | null;
  grund: string;
  /** the name of who made the change */
  von: string;
  am: number;
};

export type PruefBefund = { regel: string; norm: string; schwere: "hinweis" | "verstoss" };

/** A counter-entry to the day after its month was closed */
export type PruefGegeneintrag = { minuten: number; grund: string; von: string; am: number };

export type PruefTag = {
  tag: string;
  /** the first stamp of the working day and the last, null when there is none */
  beginn: number | null;
  ende: number | null;
  pauseMinuten: number;
  arbeitsMinuten: number;
  /** when the last stamp of the day as it stands was recorded by Soll (§ 17 Abs. 1 MiLoG) */
  erfasstAm: number | null;
  aenderungen: PruefAenderung[];
  befunde: PruefBefund[];
  gegeneintraege: PruefGegeneintrag[];
};

/** A month the period touches: closed with its Prüfwert, or still open */
export type PruefMonat = {
  monat: string;
  pruefwert: string | null;
  abgeschlossenAm: number | null;
};

export type PruefPerson = { name: string; tage: PruefTag[]; monate: PruefMonat[] };

export type Pruefexport = {
  betrieb: string;
  von: string;
  bis: string;
  erstelltAm: number;
  /** where a Prüfwert is checked */
  pruefseite: string;
  personen: PruefPerson[];
};
