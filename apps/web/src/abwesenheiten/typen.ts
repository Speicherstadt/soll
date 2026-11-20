import type {
  Abwesenheitsart,
  BescheinigungsPruefung,
  KinderkrankErgebnis,
  SichtbareArt,
  Tag,
} from "@soll/arbeitszeit";

/** An absence as the server shows it to the caller (apps/server, routes/abwesenheit-sicht.ts) */
export type Abwesenheit = {
  abwesenheitId: string;
  nutzerId: string;
  art: SichtbareArt;
  von: Tag;
  bis: Tag | null;
  ersterHalb: boolean;
  letzterHalb: boolean;
  status: "beantragt" | "genehmigt" | "abgelehnt" | "zurueckgezogen" | "storniert";
  kind: string | null;
  bescheinigung: "eau" | "papier" | null;
  grund: string | null;
  urlaubHalbtage?: number | null;
  frist?: BescheinigungsPruefung | null;
  name?: string;
};

export type Urlaubsstand = {
  jahr: number;
  anspruchHalbtage: number;
  genommenHalbtage: number;
  beantragtHalbtage: number;
  restHalbtage: number;
};

/** GET /api/v1/arbeitszeit/abwesenheiten */
export type Liste = {
  nutzerId: string;
  name: string;
  jahr: number;
  heute: Tag;
  bescheinigungAbTag: number;
  rechte: { freigeben: boolean; gesundheit: boolean; einstellen: boolean };
  abwesenheiten: Abwesenheit[];
  urlaub: Urlaubsstand | null;
  kinderkrank: KinderkrankErgebnis | null;
};

export type Erinnerung = {
  abwesenheitId: string;
  nutzerId: string;
  name: string;
  von: Tag;
  faelligAm: Tag;
  ueberfaellig: boolean;
};

/** GET /api/v1/arbeitszeit/abwesenheiten/offen */
export type Offen = { antraege: Abwesenheit[]; erinnerungen: Erinnerung[] };

/** GET /api/v1/arbeitszeit/abwesenheiten/team */
export type TeamEintrag = {
  abwesenheitId: string;
  nutzerId: string;
  name: string;
  /** every absence reads „abwesend“ in the team calendar (Art. 9 DSGVO) */
  art: "abwesend";
  von: Tag;
  /** an end beyond what is shown, or an open one, reads as the last day shown */
  bis: Tag;
  ersterHalb: boolean;
  letzterHalb: boolean;
  /** only for whoever approves leave: whether it can be cancelled here */
  stornierbar?: boolean;
};

export type GeplanteSchicht = { schichtId: string; tag: Tag; bezeichnung: string };

export const ANTRAGSARTEN = [
  "urlaub",
  "sonderurlaub",
  "ueberstundenabbau",
] as const satisfies readonly Abwesenheitsart[];
