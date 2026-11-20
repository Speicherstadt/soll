/** A personal access token as the server lists it (S-607): never the token itself */
export type Zugang = {
  zugangId: string;
  name: string;
  praefix: string;
  angelegtAm: number;
  gueltigBis: number | null;
  zuletztGenutzt: string | null;
};

/** The expiries the server offers, in days; null for none (modules/zugaenge) */
export const GUELTIGKEITEN = [30, 90, 365, null] as const;
export type Gueltigkeit = (typeof GUELTIGKEITEN)[number];
