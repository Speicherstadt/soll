import { PFAD as PFADE } from "../abfragen/schluessel.ts";

/** The DATEV payroll export as the server gives it (S-308, apps/server/src/routes/datev.ts) */

export type DatevPerson = { nutzerId: string; name: string; personalnummer: string | null };

export type DatevAnsicht = {
  beraterNr: string | null;
  mandantenNr: string | null;
  lohnarten: Record<string, string>;
  postenarten: string[];
  personen: DatevPerson[];
};

/** What keeps the export from being written, as `datevExport` names it */
export type Fehlend = {
  art: string;
  nutzerId?: string;
  name?: string;
  posten?: string;
  tage?: string[];
};

export type Ziel = "lodas" | "lug";

export const PFAD = PFADE.datev;
