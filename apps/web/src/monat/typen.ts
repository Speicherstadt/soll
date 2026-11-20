import type { Monat, Schwere, SichtbareArt, Stempelart, Tag } from "@soll/arbeitszeit";

/**
 * A day of a month: its stamps in force, the minutes of the model and its approved absences, sickness
 * only as „abwesend“ for whoever may not see it (apps/server, monatsinhalt.ts)
 */
export type Aufzeichnung = {
  tag: Tag;
  stempel: [Stempelart, number][];
  modellMinuten: number | null;
  abwesenheiten?: { art: SichtbareArt; halb?: boolean }[];
};

export type Blattbefund = {
  regel: string;
  norm: string;
  schwere: Schwere;
  art: string;
  tage: Tag[];
};

export type Gegeneintrag = { tag: Tag; minuten: number; grund: string };

export type Monatsinhalt = {
  monat: Monat;
  tage: Aufzeichnung[];
  summen: {
    sollMinuten: number;
    gearbeitetMinuten: number;
    gutschriftMinuten: number;
    istMinuten: number;
    saldoMinuten: number;
  } | null;
  nichtHinterlegt: Tag[];
  befunde: Blattbefund[];
  gegeneintraege: Gegeneintrag[];
};

/** A month of one person as GET /api/v1/arbeitszeit/monat returns it */
export type MonatAnsicht = {
  monat: Monat;
  nutzerId: string;
  eigen: boolean;
  name: string;
  inhalt: Monatsinhalt;
  offeneTage: Tag[];
  vorbei: boolean;
  /** while open: closing waits until 9 h after the last stamp, as the last shift could go on */
  abschliessbarAb: number | null;
  geaenderteTage: Tag[];
  bestaetigung: { von: string; vonName: string; am: number; gueltig: boolean } | null;
  abschluss: {
    von: string;
    vonName: string;
    am: number;
    grund: string | null;
    pruefwert: string | null;
  } | null;
};

/** What POST /api/v1/pruefen answers (apps/server, routes/pruefen.ts) */
export type Pruefung =
  | { ergebnis: "unlesbar" | "unbekannt" }
  | { ergebnis: "abweichung"; grund: "kette" | "abschluss"; betrieb: string }
  | {
      ergebnis: "uebereinstimmend" | "abweichung";
      grund: "tage" | null;
      betrieb: string;
      name: string;
      monat: Monat;
      abgeschlossenAm: number;
      tage: Tag[];
      gegeneintraege: (Gegeneintrag & { am: number })[];
    };
