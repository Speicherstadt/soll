import type { Striche } from "@soll/arbeitszeit";

/** What a Stundennachweis is about, as /api/v1/projektzeit/stundennachweise takes it (S-605) */
export type NachweisWahl = { projektId: string; von: string; bis: string; nutzerId?: string };

export type VorschauZeile = {
  buchungId: string;
  tag: string;
  person: string;
  beginn: number;
  ende: number;
  minuten: number;
  taetigkeit: string;
  notiz: string;
};

export type Vorschau = {
  kunde: { name: string; nummer: string };
  auftrag: { name: string; nummer: string };
  von: string;
  bis: string;
  zeilen: VorschauZeile[];
  summeMinuten: number;
  stand: string;
};

/** A signed report in the list */
export type NachweisKopf = {
  nachweisId: string;
  nummer: number;
  projektId: string;
  nutzerId: string | null;
  von: string;
  bis: string;
  kunde: string;
  auftrag: string;
  summeMinuten: number;
  unterzeichner: string;
  unterschriebenAm: number;
  inhaltHash: string;
};

/** What the customer gives when signing */
export type Unterzeichnet = { bemerkung: string; unterzeichner: string; unterschrift: Striche };
