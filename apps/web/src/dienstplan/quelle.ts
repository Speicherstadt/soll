import { type Tag, uhrzeitenVon } from "@soll/arbeitszeit";
import { createSignal } from "solid-js";
import { type Antwort, api } from "../api.ts";
import type { Schicht, Vorlage, Woche, Ziel } from "./typen.ts";

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

/** The week of a site from the server, loaded again after every change */
export const wochenQuelle = () => {
  const [woche, setWoche] = createSignal<Woche | null>(null);
  const [fehler, setFehler] = createSignal("");
  let zaehler = 0;
  let zuletzt: { standortId: string; tag: Tag } | null = null;
  const laden = async (anfrage = zuletzt) => {
    if (!anfrage) return;
    zuletzt = anfrage;
    const diese = ++zaehler;
    const parameter = new URLSearchParams(anfrage);
    const antwort = await api<Woche>(`/api/v1/dienstplan/woche?${parameter}`);
    // a later week or site was asked for meanwhile: its answer counts
    if (diese !== zaehler) return;
    if (!antwort.ok) return setFehler(antwort.fehler);
    setFehler("");
    setWoche(antwort.daten);
  };
  return { woche, fehler, laden };
};

export const schichtAnlegen = (eingabe: SchichtEingabe) =>
  api<Schicht>("/api/v1/dienstplan/schichten", { body: eingabe });

export const schichtAendern = (schichtId: string, aenderung: Partial<SchichtEingabe>) =>
  api<Schicht>(`/api/v1/dienstplan/schichten/${schichtId}`, { method: "PATCH", body: aenderung });

export const schichtEntfernen = (schichtId: string) =>
  api(`/api/v1/dienstplan/schichten/${schichtId}`, { method: "DELETE" });

/** Dropping a shift on a cell: another day or person, its times on the clock stay (server) */
export const verschieben = (schicht: Schicht, ziel: Ziel): Promise<Antwort<Schicht>> | null =>
  schicht.tag === ziel.tag && schicht.nutzerId === ziel.nutzerId
    ? null
    : schichtAendern(schicht.schichtId, ziel);

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
