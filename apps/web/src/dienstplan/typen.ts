import type { Deckung, Kalenderwoche, PlanSchicht, Tag } from "@soll/arbeitszeit";

/** A shift as GET /api/v1/dienstplan/woche returns it */
export type Schicht = PlanSchicht & { vorlageId: string | null; veroeffentlichtAm: number | null };

export type Planperson = { nutzerId: string; name: string };

export type Woche = {
  standortId: string;
  tage: Tag[];
  kw: Kalenderwoche;
  personen: Planperson[];
  schichten: Schicht[];
  /** null for whoever does not plan */
  deckung: Deckung[] | null;
};

export type Vorlage = {
  vorlageId: string;
  name: string;
  beginnMinute: number;
  endeMinute: number;
  pauseMinuten: number;
  rolle: string;
  standortId: string | null;
};

export type BedarfZeile = {
  bedarfId: string;
  standortId: string;
  rolle: string;
  wochentag: number;
  beginnMinute: number;
  endeMinute: number;
  anzahl: number;
};

export type Standort = { standortId: string; name: string };

/** Where a shift goes: a person (null for open) on a day */
export type Ziel = { nutzerId: string | null; tag: Tag };
