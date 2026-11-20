import type { ProjektzeitHinweis } from "@soll/arbeitszeit";

/** A booking of project time as /api/v1/projektzeit returns it (S-602) */
export type Buchung = {
  buchungId: string;
  nutzerId: string;
  projektId: string | null;
  taetigkeitId: string;
  beginn: number;
  /** null while the stopwatch runs */
  ende: number | null;
  tag: string;
  notiz: string;
  abgerechnetAm: number | null;
  minuten: number;
  /** the Kommen of the shift the booking falls in, or null */
  kommen: { stempelId: string; zeitpunkt: number } | null;
};

/** What a booking is on: an order (none for internal time) and an activity */
export type Wahl = { projektId: string | null; taetigkeitId: string };

/** The stopwatch's day (GET /api/v1/projektzeit/stoppuhr) */
export type StoppuhrTag = {
  nutzerId: string;
  tag: string;
  jetzt: number;
  laufend: Buchung | null;
  buchungen: Buchung[];
  gebuchtMinuten: number;
  gestempeltMinuten: number | null;
  hinweis: ProjektzeitHinweis | null;
  zuletzt: Wahl[];
};
