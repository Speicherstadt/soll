import { tagInBerlin } from "@soll/arbeitszeit";
import type { Zuordnung } from "@soll/import";
import { createSignal, createStore, snapshot } from "solid-js";
import { aenderung } from "../abfragen/abfrage.ts";
import { alle, PFAD } from "../abfragen/schluessel.ts";
import { type Antwort, api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import type { Abruf, Datei, Probelauf, Uebernahme, Vorschau } from "./typen.ts";
import type { Aendern } from "./zuordnung.tsx";
import { koerperVon, letzterAbschliessbarer, spaltenwahl, zuordnungAus } from "./zustand.ts";

/*
 * The state of the move page and its calls (S-701): the file is sent with each call, the server
 * reads it again every time; a fetch over a tool's API becomes such a file (S-703); a change of the mapping drops the dry run, so the takeover always
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
  alle(PFAD.taetigkeiten),
];

/** Why a fetch over a tool's API failed (routes/importe-abruf.ts, S-703) */
const ABRUF_FEHLER: Record<string, () => string> = {
  zugang_abgelehnt: () => m.umzug_abruf_zugang_abgelehnt(),
  zu_viele_anfragen: () => m.umzug_abruf_zu_viele_anfragen(),
  nicht_erreichbar: () => m.umzug_abruf_nicht_erreichbar(),
  antwort_ungueltig: () => m.umzug_abruf_antwort_ungueltig(),
  zu_viele: () => m.umzug_abruf_zu_viele(),
  zeitraum: () => m.umzug_abruf_zeitraum(),
};

const fehlerText = (antwort: Antwort<unknown>): string => {
  if (antwort.ok) return "";
  if (antwort.status === 0) return m.fehler_netz();
  if (antwort.status === 413) return m.umzug_fehler_zu_gross();
  if (antwort.fehler === "gleichzeitig") return m.umzug_fehler_gleichzeitig();
  return ABRUF_FEHLER[antwort.fehler ?? ""]?.() ?? m.fehler_speichern();
};

const zustand = () => {
  const [schritt, setSchritt] = createSignal(0);
  const [quelle, setQuelle] = createSignal("soll-csv");
  // the way in of a tool with an API as well as a file (S-703)
  const [weg, setWeg] = createSignal<"datei" | "api">("datei");
  const [datei, setDatei] = createSignal<Datei | null>(null);
  const [vorschau, setVorschau] = createSignal<Vorschau | null>(null);
  const [spalten, setSpalten] = createSignal<Record<string, string | null>>({});
  const [zuordnung, setZuordnung] = createStore<Zuordnung>({
    personen: {},
    arten: {},
    kunden: {},
    projekte: {},
    taetigkeiten: {},
  });
  const [bis, setBis] = createSignal<string | null>(null);
  const [probelauf, setProbelauf] = createSignal<Probelauf | null>(null);
  const [uebernahme, setUebernahme] = createSignal<Uebernahme | null>(null);
  const [fehler, setFehler] = createSignal("");
  return {
    ...{ schritt, setSchritt, quelle, setQuelle, weg, setWeg, datei, setDatei },
    ...{ vorschau, setVorschau },
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
  abruf: aenderung(
    (body: unknown) => api<{ datei: Datei }>(`${PFAD.importe}/abruf`, { body }),
    () => [],
  ),
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
    taetigkeit: (id, ziel) =>
      geaendert((e) => {
        e.taetigkeiten[id] = ziel;
      }),
  };
};

/**
 * Fetches the data over the tool's API; the file it becomes is read like an uploaded one. The access
 * goes with this one call and is kept nowhere here (docs/plan.md, "API-Zugang eines Werkzeugs").
 */
const abrufen = async (z: Zustand, a: Aufrufe, abruf: Abruf): Promise<boolean> => {
  const antwort = await a.abruf.mutate({ quelle: z.quelle(), ...abruf });
  z.setFehler(fehlerText(antwort));
  if (!antwort.ok) return false;
  await vorschauLaden(z, a, antwort.daten.datei, {});
  return true;
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
    setQuelle: (quelle: string) => {
      z.setQuelle(quelle);
      z.setWeg("datei");
    },
    arbeitet: () =>
      a.lesen.isPending || a.probe.isPending || a.nehmen.isPending || a.abruf.isPending,
    dateiGewaehlt: (datei: Datei) => vorschauLaden(z, a, datei, {}),
    abrufen: (abruf: Abruf) => abrufen(z, a, abruf),
    probieren: () => probieren(z, a),
    uebernehmen: () => uebernehmen(z, a),
    neu: () => vonVorn(z),
  };
};

export type Ablauf = ReturnType<typeof umzugAblauf>;
