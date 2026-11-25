import type { Tag } from "@soll/arbeitszeit";
import { alle, PFAD } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { PLAN_AENDERT } from "./quelle.ts";
import type { PlanBefund } from "./typen.ts";

/*
 * The shift swap in the app (S-504): what GET /api/v1/dienstplan/tausch returns, the calls of each
 * step and which steps a person has on a swap, as pure functions
 */

export type TauschStatus =
  | "offen"
  | "uebernommen"
  | "freigegeben"
  | "abgelehnt"
  | "zurueckgezogen"
  | "hinfaellig";

type Person = { nutzerId: string; name: string };

export type Schichtkopf = {
  schichtId: string;
  standortId: string;
  tag: Tag;
  beginn: number;
  ende: number;
  pauseMinuten: number;
  rolle: string;
};

export type TauschAnsicht = {
  tauschId: string;
  status: TauschStatus;
  schicht: Schichtkopf;
  anbieter: Person;
  an: Person | null;
  uebernehmer: Person | null;
  grund: string | null;
  angebotenAm: number;
  /** the findings for whoever took it; only for whoever plans */
  befunde: PlanBefund[] | null;
};

export type Tauschbuch = {
  tausche: TauschAnsicht[];
  anbietbar: Schichtkopf[];
  kollegen: Person[];
  ohneFreigabe: boolean;
};

/** A swap changes the swaps and, once approved, the weeks of the plan */
export const TAUSCH_AENDERT = [alle(PFAD.tausch), ...PLAN_AENDERT];

const PFAD_TAUSCH = PFAD.tausch;

export const tauschAnbieten = (schichtId: string, anNutzerId: string | null) =>
  api<TauschAnsicht>(PFAD_TAUSCH, { body: { schichtId, anNutzerId } });

export const tauschSchritt = (tauschId: string, schritt: "uebernehmen" | "freigeben") =>
  api(`${PFAD_TAUSCH}/${encodeURIComponent(tauschId)}/${schritt}`, { body: {} });

export const tauschAblehnen = (tauschId: string, grund: string) =>
  api(`${PFAD_TAUSCH}/${encodeURIComponent(tauschId)}/ablehnen`, { body: { grund } });

export const tauschZurueckziehen = (tauschId: string) =>
  api(`${PFAD_TAUSCH}/${encodeURIComponent(tauschId)}`, { method: "DELETE" });

export const tauschregelSetzen = (ohneFreigabe: boolean) =>
  api(`${PFAD_TAUSCH}/regel`, { method: "PUT", body: { ohneFreigabe } });

export type Aktion = "uebernehmen" | "zurueckziehen" | "freigeben" | "ablehnen";

const offen = (status: TauschStatus) => status === "offen" || status === "uebernommen";

/**
 * The steps a person has on a swap: take an open offer meant for them, withdraw their own while it
 * is undecided; whoever plans approves a swap that was taken and refuses an undecided one. The
 * server checks each again.
 */
export const aktionenFuer = (
  tausch: TauschAnsicht,
  ich: { nutzerId: string; planer: boolean },
): Aktion[] => {
  const eigenes = tausch.anbieter.nutzerId === ich.nutzerId;
  const gemeint = tausch.an === null || tausch.an.nutzerId === ich.nutzerId;
  return [
    ...(tausch.status === "offen" && !eigenes && gemeint ? (["uebernehmen"] as const) : []),
    ...(eigenes && offen(tausch.status) ? (["zurueckziehen"] as const) : []),
    ...(ich.planer && tausch.status === "uebernommen" ? (["freigeben"] as const) : []),
    ...(ich.planer && offen(tausch.status) ? (["ablehnen"] as const) : []),
  ];
};
