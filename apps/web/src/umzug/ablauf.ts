import { tagInBerlin } from "@soll/arbeitszeit";
import type { Zuordnung } from "@soll/import";
import { createSignal, createStore, snapshot } from "solid-js";
import { aenderung } from "../abfragen/abfrage.ts";
import { alle, PFAD } from "../abfragen/schluessel.ts";
import { type Antwort, api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import type { Datei, Probelauf, Uebernahme, Vorschau } from "./typen.ts";
import type { Aendern } from "./zuordnung.tsx";
import { koerperVon, letzterAbschliessbarer, spaltenwahl, zuordnungAus } from "./zustand.ts";

/*
 * The state of the move page and its calls (S-701): the file is sent with each call, the server
 * reads it again every time; a change of the mapping drops the dry run, so the takeover always
 * follows a dry run of the mapping it takes over with.
 */

/** What a takeover changes: the list of imports and every resource it may have written into */
const AENDERT = () => [
  alle(PFAD.importe),
  alle(PFAD.tag),
  alle(PFAD.monat),
  alle(PFAD.abwesenheiten),
  alle(PFAD.abwesenheitenTeam),
  alle(PFAD.kunden),
  alle(PFAD.projekte),
];

const fehlerText = (antwort: Antwort<unknown>): string => {
  if (antwort.ok) return "";
  if (antwort.status === 0) return m.fehler_netz();
  if (antwort.status === 413) return m.umzug_fehler_zu_gross();
  if (antwort.fehler === "gleichzeitig") return m.umzug_fehler_gleichzeitig();
  return m.fehler_speichern();
};

const zustand = () => {
  const [schritt, setSchritt] = createSignal(0);
  const [quelle, setQuelle] = createSignal("soll-csv");
  const [datei, setDatei] = createSignal<Datei | null>(null);
  const [vorschau, setVorschau] = createSignal<Vorschau | null>(null);
  const [spalten, setSpalten] = createSignal<Record<string, string | null>>({});
  const [zuordnung, setZuordnung] = createStore<Zuordnung>({
    personen: {},
    arten: {},
    kunden: {},
    projekte: {},
  });
  const [bis, setBis] = createSignal<string | null>(null);
  const [probelauf, setProbelauf] = createSignal<Probelauf | null>(null);
  const [uebernahme, setUebernahme] = createSignal<Uebernahme | null>(null);
  const [fehler, setFehler] = createSignal("");
  return {
    ...{ schritt, setSchritt, quelle, setQuelle, datei, setDatei, vorschau, setVorschau },
    ...{ spalten, setSpalten, zuordnung, setZuordnung, bis, setBis, probelauf, setProbelauf },
    ...{ uebernahme, setUebernahme, fehler, setFehler },
  };
};

type Zustand = ReturnType<typeof zustand>;

const aufrufe = () => ({
  lesen: aenderung(
    (body: unknown) => api<Vorschau>(`${PFAD.importe}/vorschau`, { body }),
    () => [],
  ),
  probe: aenderung(
    (body: unknown) => api<Probelauf>(`${PFAD.importe}/probelauf`, { body }),
    () => [],
  ),
  nehmen: aenderung((body: unknown) => api<Uebernahme>(PFAD.importe, { body }), AENDERT),
});

type Aufrufe = ReturnType<typeof aufrufe>;

/** Reads the file with the columns chosen; a new reading starts the mapping from Soll's proposal */
const vorschauLaden = async (
  z: Zustand,
  a: Aufrufe,
  datei: Datei,
  wahl: Record<string, string | null>,
) => {
  const body = { quelle: z.quelle(), datei, spalten: spaltenwahl(wahl) };
  const antwort = await a.lesen.mutate(body);
  z.setFehler(fehlerText(antwort));
  if (!antwort.ok) return;
  z.setDatei(datei);
  z.setVorschau(antwort.daten);
  z.setSpalten(antwort.daten.spalten);
  z.setZuordnung(() => zuordnungAus(antwort.daten));
  z.setProbelauf(null);
};

/** The body of the dry run and the takeover, or null before a file is read */
const auswahl = (z: Zustand) => {
  const datei = z.datei();
  if (datei === null) return null;
  return koerperVon({
    quelle: z.quelle(),
    datei,
    spalten: spaltenwahl(z.spalten()),
    zuordnung: snapshot(z.zuordnung),
    abgeschlossenBis: z.bis(),
  });
};

/** Every change of the mapping drops the dry run of the mapping before it */
const aenderungen = (z: Zustand, a: Aufrufe): Aendern => {
  const geaendert = (schreiben: (entwurf: Zuordnung) => void) => {
    z.setZuordnung((entwurf) => {
      schreiben(entwurf);
    });
    z.setProbelauf(null);
  };
  return {
    spalte: (feld, kopf) => {
      const wahl = { ...z.spalten(), [feld]: kopf };
      z.setSpalten(wahl);
      const datei = z.datei();
      if (datei) void vorschauLaden(z, a, datei, wahl);
    },
    person: (person, ziel) =>
      geaendert((e) => {
        e.personen[person] = ziel;
      }),
    art: (art, ziel) =>
      geaendert((e) => {
        e.arten[art] = ziel;
      }),
    kunde: (id, ziel) =>
      geaendert((e) => {
        e.kunden[id] = ziel;
      }),
    projekt: (id, ziel) =>
      geaendert((e) => {
        e.projekte[id] = ziel;
      }),
  };
};

const probieren = async (z: Zustand, a: Aufrufe) => {
  const body = auswahl(z);
  if (body === null) return;
  const antwort = await a.probe.mutate(body);
  z.setFehler(fehlerText(antwort));
  z.setProbelauf(antwort.ok ? antwort.daten : null);
};

const uebernehmen = async (z: Zustand, a: Aufrufe) => {
  const body = auswahl(z);
  if (body === null) return;
  const antwort = await a.nehmen.mutate(body);
  z.setFehler(fehlerText(antwort));
  if (antwort.ok) z.setUebernahme(antwort.daten);
  else z.setProbelauf(null);
};

const vonVorn = (z: Zustand) => {
  z.setDatei(null);
  z.setVorschau(null);
  z.setProbelauf(null);
  z.setUebernahme(null);
  z.setBis(null);
  z.setSchritt(0);
};

export const umzugAblauf = () => {
  const z = zustand();
  const a = aufrufe();
  return {
    ...z,
    aendern: aenderungen(z, a),
    setBis: (wert: string | null) => {
      z.setBis(wert);
      z.setProbelauf(null);
    },
    hoechstens: () => letzterAbschliessbarer(tagInBerlin(Date.now())),
    arbeitet: () => a.lesen.isPending || a.probe.isPending || a.nehmen.isPending,
    dateiGewaehlt: (datei: Datei) => vorschauLaden(z, a, datei, {}),
    probieren: () => probieren(z, a),
    uebernehmen: () => uebernehmen(z, a),
    neu: () => vonVorn(z),
  };
};

export type Ablauf = ReturnType<typeof umzugAblauf>;
