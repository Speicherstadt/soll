import { type Tag, uhrzeitenVon } from "@soll/arbeitszeit";
import { alle, PFAD } from "../abfragen/schluessel.ts";
import { type Antwort, api } from "../api.ts";
import type { Schicht, Vorlage, Ziel } from "./typen.ts";

/** What a shift is planned with: a day and times on the Berlin clock (POST /schichten) */
export type SchichtEingabe = {
  standortId: string;
  tag: Tag;
  beginnMinute: number;
  endeMinute: number;
  pauseMinuten: number;
  rolle: string;
  nutzerId: string | null;
  vorlageId?: string | null;
};

/** What a change to shifts or the need changes: the weeks of the plan, plus Soll-dependent views */
export const PLAN_AENDERT = [
  alle(PFAD.woche),
  alle(PFAD.monat),
  alle(PFAD.tag),
  alle(PFAD.abwesenheiten),
  alle(PFAD.abwesenheitenOffen),
  alle(PFAD.konten),
];

export const schichtAnlegen = (eingabe: SchichtEingabe) =>
  api<Schicht>("/api/v1/dienstplan/schichten", { body: eingabe });

export const schichtAendern = (schichtId: string, aenderung: Partial<SchichtEingabe>) =>
  api<Schicht>(`/api/v1/dienstplan/schichten/${schichtId}`, { method: "PATCH", body: aenderung });

export const schichtEntfernen = (schichtId: string) =>
  api(`/api/v1/dienstplan/schichten/${schichtId}`, { method: "DELETE" });

/** Whether a shift dropped on a cell stays where it is (same day and person) */
export const bleibt = (schicht: Schicht, ziel: Ziel): boolean =>
  schicht.tag === ziel.tag && schicht.nutzerId === ziel.nutzerId;

/** Dropping a shift on a cell: another day or person, its times on the clock stay (server) */
export const verschieben = (schicht: Schicht, ziel: Ziel): Promise<Antwort<Schicht>> =>
  schichtAendern(schicht.schichtId, ziel);

/** Dropping a template on a cell plans a shift from it */
export const ausVorlage = (vorlage: Vorlage, standortId: string, ziel: Ziel) =>
  schichtAnlegen({
    standortId,
    tag: ziel.tag,
    nutzerId: ziel.nutzerId,
    beginnMinute: vorlage.beginnMinute,
    endeMinute: vorlage.endeMinute,
    pauseMinuten: vorlage.pauseMinuten,
    rolle: vorlage.rolle,
    vorlageId: vorlage.vorlageId,
  });

/** The times of a shift as typed, to fill the form for a change */
export const eingabeVon = (schicht: Schicht): SchichtEingabe => ({
  standortId: schicht.standortId,
  tag: schicht.tag,
  ...uhrzeitenVon(schicht),
  pauseMinuten: schicht.pauseMinuten,
  rolle: schicht.rolle,
  nutzerId: schicht.nutzerId,
  vorlageId: schicht.vorlageId,
});

/** Publishes the drafts of the week around a day at a site (S-503) */
export const wocheVeroeffentlichen = (standortId: string, tag: Tag) =>
  api<{ anzahl: number; benachrichtigt: number }>("/api/v1/dienstplan/veroeffentlichen", {
    body: { standortId, tag },
  });
