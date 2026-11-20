import { abfrage, daten, schreiben } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { type Antwort, api } from "../api.ts";
import type { Kunde, Person, Projekt, Satz, Taetigkeit } from "./typen.ts";

const PZ = "/api/v1/projektzeit";

/** A change to one list may change the others (an order names a customer, a rate an order) */
const PROJEKTE_AENDERT = [
  alle(PFAD.kunden),
  alle(PFAD.projekte),
  alle(PFAD.taetigkeiten),
  alle(PFAD.saetze),
  alle(PFAD.satzPersonen),
];

/**
 * The data of the page Projekte, a query per list (read under `<Loading>`). Rates and the people
 * they can name only for whoever keeps the orders (owner, planner): the server refuses them to
 * others, so they are not asked for.
 */
export const projektQuelle = (verwalten: boolean) => {
  const kunden = abfrage<{ kunden: Kunde[] }>(ressourcen.kunden);
  const projekte = abfrage<{ projekte: Projekt[] }>(ressourcen.projekte);
  const taetigkeiten = abfrage<{ taetigkeiten: Taetigkeit[] }>(ressourcen.taetigkeiten);
  const saetze = abfrage<{ saetze: Satz[] }>(() => (verwalten ? ressourcen.saetze() : null));
  const personen = abfrage<{ personen: Person[] }>(() =>
    verwalten ? ressourcen.satzPersonen() : null,
  );
  const nurVerwalten = <T>(lesen: () => T[] | undefined): T[] => (verwalten ? (lesen() ?? []) : []);
  return {
    kunden: () => daten(kunden.data)?.kunden ?? [],
    projekte: () => daten(projekte.data)?.projekte ?? [],
    taetigkeiten: () => daten(taetigkeiten.data)?.taetigkeiten ?? [],
    saetze: () => nurVerwalten(() => daten(saetze.data)?.saetze),
    personen: () => nurVerwalten(() => daten(personen.data)?.personen),
    fehler: () =>
      !kunden.data.ok ||
      !projekte.data.ok ||
      !taetigkeiten.data.ok ||
      (verwalten && (!saetze.data.ok || !personen.data.ok)),
    verwalten,
  };
};

export type ProjektQuelle = ReturnType<typeof projektQuelle>;

/**
 * Add, change, archive, restore and remove a row below /api/v1/projektzeit/<art>; the lists load
 * again after each, and a refusal comes back as its text. `arbeitet` while a write is on its way.
 */
export const zeilenAktionen = (art: string, fehler: (text: string) => void) => {
  const senden = schreiben(() => PROJEKTE_AENDERT);
  const nach = async (auftrag: () => Promise<Antwort<unknown>>) => {
    const antwort = await senden.mutate(auftrag);
    fehler(antwort.ok ? "" : antwort.fehler);
    return antwort.ok;
  };
  return {
    arbeitet: () => senden.isPending,
    archivieren: (id: string, archiviert: boolean) =>
      nach(() => api(`${PZ}/${art}/${id}`, { method: "PATCH", body: { archiviert } })),
    aendern: (id: string, body: object) =>
      nach(() => api(`${PZ}/${art}/${id}`, { method: "PATCH", body })),
    entfernen: (id: string) => nach(() => api(`${PZ}/${art}/${id}`, { method: "DELETE" })),
    anlegen: (body: object) => nach(() => api(`${PZ}/${art}`, { body })),
  };
};
