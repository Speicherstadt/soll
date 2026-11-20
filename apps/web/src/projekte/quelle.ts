import { createSignal } from "solid-js";
import { api } from "../api.ts";
import type { Kunde, Person, Projekt, Satz, Taetigkeit } from "./typen.ts";

const PZ = "/api/v1/projektzeit";

/**
 * The data of the page Projekte, loaded together and again after every change. Rates and the people
 * they can name only for whoever keeps the orders (owner, planner): the server refuses them to others.
 */
export const projektQuelle = (verwalten: boolean) => {
  const [kunden, setKunden] = createSignal<Kunde[]>([]);
  const [projekte, setProjekte] = createSignal<Projekt[]>([]);
  const [taetigkeiten, setTaetigkeiten] = createSignal<Taetigkeit[]>([]);
  const [saetze, setSaetze] = createSignal<Satz[]>([]);
  const [personen, setPersonen] = createSignal<Person[]>([]);
  const [fehler, setFehler] = createSignal(false);
  const laden = async () => {
    const [k, p, t, s, n] = await Promise.all([
      api<{ kunden: Kunde[] }>(`${PZ}/kunden`),
      api<{ projekte: Projekt[] }>(`${PZ}/projekte`),
      api<{ taetigkeiten: Taetigkeit[] }>(`${PZ}/taetigkeiten`),
      verwalten ? api<{ saetze: Satz[] }>(`${PZ}/saetze`) : null,
      verwalten ? api<{ personen: Person[] }>(`${PZ}/saetze/personen`) : null,
    ]);
    setFehler(!k.ok || !p.ok || !t.ok || s?.ok === false || n?.ok === false);
    if (k.ok) setKunden(k.daten.kunden);
    if (p.ok) setProjekte(p.daten.projekte);
    if (t.ok) setTaetigkeiten(t.daten.taetigkeiten);
    if (s?.ok) setSaetze(s.daten.saetze);
    if (n?.ok) setPersonen(n.daten.personen);
  };
  void laden();
  return { kunden, projekte, taetigkeiten, saetze, personen, fehler, laden, verwalten };
};

export type ProjektQuelle = ReturnType<typeof projektQuelle>;

/**
 * Archive, restore and remove a row below /api/v1/projektzeit/<art>; the page loads again after
 * each, and a refusal comes back as its text
 */
export const zeilenAktionen = (
  art: string,
  quelle: ProjektQuelle,
  fehler: (text: string) => void,
) => {
  const nach = async (antwort: Awaited<ReturnType<typeof api>>) => {
    if (!antwort.ok) return fehler(antwort.fehler);
    fehler("");
    await quelle.laden();
  };
  return {
    archivieren: async (id: string, archiviert: boolean) =>
      nach(await api(`${PZ}/${art}/${id}`, { method: "PATCH", body: { archiviert } })),
    aendern: async (id: string, body: object) =>
      nach(await api(`${PZ}/${art}/${id}`, { method: "PATCH", body })),
    entfernen: async (id: string) => nach(await api(`${PZ}/${art}/${id}`, { method: "DELETE" })),
    anlegen: async (body: object) => {
      const antwort = await api(`${PZ}/${art}`, { body });
      await nach(antwort);
      return antwort.ok;
    },
  };
};
