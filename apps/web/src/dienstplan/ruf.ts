import { type Tag, uhrzeitenVon } from "@soll/arbeitszeit";
import { api } from "../api.ts";
import type { Rufdienst } from "./typen.ts";

/** What a Rufbereitschaft is planned with: a day and times on the Berlin clock (S-505) */
export type RufEingabe = {
  standortId: string;
  nutzerId: string;
  tag: Tag;
  beginnMinute: number;
  endeMinute: number;
  /** null: none agreed, the whole duty counts for the limits (R-12) */
  reaktionMinuten: number | null;
};

const PFAD = "/api/v1/dienstplan/rufdienste";

export const rufAnlegen = (eingabe: RufEingabe) => api<Rufdienst>(PFAD, { body: eingabe });

export const rufAendern = (rufdienstId: string, aenderung: Partial<RufEingabe>) =>
  api<Rufdienst>(`${PFAD}/${rufdienstId}`, { method: "PATCH", body: aenderung });

export const rufEntfernen = (rufdienstId: string) =>
  api(`${PFAD}/${rufdienstId}`, { method: "DELETE" });

/** The values of a Rufbereitschaft as typed, to fill the form for a change */
export const rufEingabeVon = (rufdienst: Rufdienst): RufEingabe => ({
  standortId: rufdienst.standortId,
  nutzerId: rufdienst.nutzerId,
  tag: rufdienst.tag,
  ...uhrzeitenVon(rufdienst),
  reaktionMinuten: rufdienst.reaktionMinuten,
});
