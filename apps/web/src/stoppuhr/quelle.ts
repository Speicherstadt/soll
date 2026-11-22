import { createMemo, createSignal, onSettled } from "solid-js";
import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { type Antwort, api } from "../api.ts";
import type { Kunde, Projekt, Taetigkeit } from "../projekte/typen.ts";
import type { StoppuhrTag, Wahl } from "./typen.ts";

const PZ = "/api/v1/projektzeit";

/** How often the running booking counts on: its minutes change once a minute */
const TAKT_MS = 15_000;

/** A booking changes the stopwatch's days and the budgets of the orders */
const BUCHUNG_AENDERT = [alle(PFAD.stoppuhr), alle(PFAD.projekte)];

/**
 * The stopwatch's day (a query per day) with the orders, customers and activities to choose from,
 * and the server's clock: the device's may be wrong, so the app keeps only its distance to the
 * server's to count the running booking on. Read under `<Loading>`.
 */
export const stoppuhrQuelle = (tag: () => string | undefined) => {
  const stand = abfrage<StoppuhrTag>(() => ressourcen.stoppuhr({ tag: tag() }));
  const projekte = abfrage<{ projekte: Projekt[] }>(ressourcen.projekte);
  const kunden = abfrage<{ kunden: Kunde[] }>(ressourcen.kunden);
  const taetigkeiten = abfrage<{ taetigkeiten: Taetigkeit[] }>(ressourcen.taetigkeiten);
  const [jetzt, setJetzt] = createSignal(Date.now());
  const ansicht = createMemo(() => daten(stand.data) ?? null);
  const abstand = createMemo(() => {
    const geladen = ansicht();
    return geladen ? geladen.jetzt - Date.now() : 0;
  });
  onSettled(() => {
    const takt = setInterval(() => setJetzt(Date.now() + abstand()), TAKT_MS);
    return () => clearInterval(takt);
  });
  return {
    ansicht,
    /** the server's clock, at least the instant of the answer */
    jetzt: () => Math.max(jetzt(), ansicht()?.jetzt ?? 0),
    projekte: () => daten(projekte.data)?.projekte ?? [],
    kunden: () => daten(kunden.data)?.kunden ?? [],
    taetigkeiten: () => daten(taetigkeiten.data)?.taetigkeiten ?? [],
    fehler: () => !stand.data.ok || !projekte.data.ok || !taetigkeiten.data.ok,
  };
};

export type StoppuhrQuelle = ReturnType<typeof stoppuhrQuelle>;

/** A booking's fields as the dialog sends them */
export type BuchungFelder = Wahl & { beginn: number; ende?: number; notiz: string };

/**
 * The writes of the stopwatch: start (a switch while one runs), stop, change, add and remove; the
 * day and the budgets load again after each, and a refusal comes back as the answer
 */
export const stoppuhrAktionen = () => {
  const senden = aenderung<() => Promise<Antwort<unknown>>, unknown>(
    (auftrag) => auftrag(),
    () => BUCHUNG_AENDERT,
  );
  return {
    arbeitet: () => senden.isPending,
    starten: (wahl: Wahl) => senden.mutate(() => api(`${PZ}/stoppuhr/start`, { body: wahl })),
    stoppen: () => senden.mutate(() => api(`${PZ}/stoppuhr/stopp`, { body: {} })),
    aendern: (buchungId: string, felder: Partial<BuchungFelder>) =>
      senden.mutate(() => api(`${PZ}/buchungen/${buchungId}`, { method: "PATCH", body: felder })),
    nachtragen: (felder: BuchungFelder) =>
      senden.mutate(() => api(`${PZ}/buchungen`, { body: felder })),
    entfernen: (buchungId: string) =>
      senden.mutate(() => api(`${PZ}/buchungen/${buchungId}`, { method: "DELETE" })),
  };
};

export type StoppuhrAktionen = ReturnType<typeof stoppuhrAktionen>;
