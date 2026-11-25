/** The link to Haben as /api/v1/projektzeit/haben answers (S-606) */

export type HabenZugang = { adresse: string; tokenGesetzt: true; geaendertAm: number };

export type HabenKontakt = {
  id: string;
  name: string;
  kundennummer: string | null;
  /** the customer of the business it is linked to, null for none */
  kundeId: string | null;
};

export type Stand = "offen" | "abgerechnet" | "wartet" | "gesendet";

export type UebergabeZeile = {
  buchungId: string;
  stand: Stand;
  leistungId: string | null;
  gesendetAm: number | null;
  fehler: string | null;
  meldung: string | null;
  tag: string;
  beginn: number;
  ende: number;
  minuten: number;
  person: string;
  taetigkeit: string;
  notiz: string;
  abrechenbar: boolean;
};

export type UebergabeListe = { kontaktId: string | null; buchungen: UebergabeZeile[] };

export type UebergabeWahl = { projektId: string; von: string; bis: string };
