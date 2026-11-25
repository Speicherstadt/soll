import type { BudgetZeile } from "@soll/arbeitszeit";

/** The rows of the module Projektzeit as /api/v1/projektzeit returns them (S-601) */
export type Kunde = {
  kundeId: string;
  name: string;
  nummer: string;
  archiviertAm: number | null;
  /** the row in another source it is linked to, e.g. "haben" (S-606); null for none */
  externQuelle?: string | null;
};

export type Projekt = {
  projektId: string;
  kundeId: string;
  name: string;
  nummer: string;
  budgetMinuten: number | null;
  /** missing for whoever does not keep the orders: money is theirs only */
  budgetCent?: number | null;
  warnungProzent: number;
  archiviertAm: number | null;
  /** what the bookings used, a line per budget set (S-602); euros only for whoever keeps orders */
  budget?: BudgetZeile[];
};

export type Taetigkeit = {
  taetigkeitId: string;
  name: string;
  /** one of the four fixed internal activities, named by the app */
  fest: boolean;
  abrechenbar: boolean;
  archiviertAm: number | null;
};

export type Satz = {
  satzId: string;
  kundeId: string | null;
  projektId: string | null;
  taetigkeitId: string | null;
  nutzerId: string | null;
  gueltigAb: string;
  centProStunde: number;
};

export type Person = { nutzerId: string; name: string };
