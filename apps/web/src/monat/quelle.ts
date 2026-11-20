import { createEffect, createSignal } from "solid-js";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import type { Person } from "../zeiten/typen.ts";
import { MAIL } from "./stand.tsx";
import { FEHLER } from "./text.ts";
import type { MonatAnsicht } from "./typen.ts";
import { vormonat } from "./zeilen.ts";

/**
 * The state of the month page: which person and month, the month as the server answers, and the
 * steps (confirm, close) with what they report
 */
export const monatQuelle = () => {
  const [monat, setMonat] = createSignal(vormonat(Date.now()));
  const [nutzerId, setNutzerId] = createSignal<string | undefined>(undefined);
  const [personen, setPersonen] = createSignal<Person[]>([]);
  const [ansicht, setAnsicht] = createSignal<MonatAnsicht | null>(null);
  const [fehler, setFehler] = createSignal("");
  const [meldung, setMeldung] = createSignal("");
  api<{ personen: Person[] }>("/api/v1/arbeitszeit/personen").then(
    (antwort) => antwort.ok && setPersonen(antwort.daten.personen),
  );
  const abfrage = () => {
    const wer = nutzerId();
    return `monat=${monat()}${wer ? `&nutzerId=${encodeURIComponent(wer)}` : ""}`;
  };
  const laden = async (anfrage: string) => {
    const antwort = await api<MonatAnsicht>(`/api/v1/arbeitszeit/monat?${anfrage}`);
    // an answer to a request no longer asked is dropped (a quick click to the next month)
    if (anfrage !== abfrage()) return;
    setFehler(antwort.ok ? "" : m.laden_fehler());
    setAnsicht(antwort.ok ? antwort.daten : null);
  };
  createEffect(
    () => abfrage(),
    (anfrage) => {
      setMeldung("");
      void laden(anfrage);
    },
  );
  const nachSchritt = (daten: unknown) => {
    const neu = daten as MonatAnsicht & { mail?: string };
    setFehler("");
    setAnsicht(neu);
    setMeldung(neu.mail ? (MAIL[neu.mail] ?? (() => ""))() : "");
  };
  const schritt = async (pfad: string, body: unknown) => {
    const antwort = await api<MonatAnsicht>(pfad, { body });
    if (!antwort.ok) return setFehler((FEHLER[antwort.fehler] ?? (() => m.fehler_speichern()))());
    nachSchritt(antwort.daten);
  };
  return {
    monat,
    setMonat,
    nutzerId,
    setNutzerId,
    personen,
    ansicht,
    fehler,
    meldung,
    setMeldung,
    abfrage,
    schritt,
    nachSchritt,
  };
};
