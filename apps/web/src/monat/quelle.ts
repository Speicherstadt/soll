import { createSignal } from "solid-js";
import { abfrage, aenderung } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import type { Person } from "../zeiten/typen.ts";
import { MAIL } from "./stand.tsx";
import { FEHLER } from "./text.ts";
import type { MonatAnsicht } from "./typen.ts";
import { vormonat } from "./zeilen.ts";

type Schritt = { pfad: string; body: unknown };

/** What a step changes: the month, the days it closes or counters, and the overtime (S-402) */
export const MONAT_AENDERT = [alle(PFAD.monat), alle(PFAD.tag), alle(PFAD.konten)];

/**
 * The state of the month page: which person and month, the month as the server answers (a query per
 * person and month), and the steps (confirm, close) with what they report
 */
export const monatQuelle = () => {
  const [monat, setMonat] = createSignal(vormonat(Date.now()));
  const [nutzerId, setNutzerId] = createSignal<string | undefined>(undefined);
  const [fehler, setFehler] = createSignal("");
  const [meldung, setMeldung] = createSignal("");
  const personen = abfrage<{ personen: Person[] }>(ressourcen.personen);
  const ansicht = abfrage<MonatAnsicht>(() =>
    ressourcen.monat({ monat: monat(), nutzerId: nutzerId() }),
  );
  /** another person or month: what a step reported belongs to the one before */
  const waehlen =
    <T>(setzen: (wert: T) => void) =>
    (wert: T) => {
      setMeldung("");
      setFehler("");
      setzen(wert);
    };
  const nachSchritt = (daten: unknown) => {
    const neu = daten as MonatAnsicht & { mail?: string };
    setFehler("");
    setMeldung(neu.mail ? (MAIL[neu.mail] ?? (() => ""))() : "");
  };
  const senden = aenderung(
    (schritt: Schritt) => api<MonatAnsicht>(schritt.pfad, { body: schritt.body }),
    () => MONAT_AENDERT,
  );
  const schritt = async (pfad: string, body: unknown) => {
    const antwort = await senden.mutate({ pfad, body });
    if (!antwort.ok) return setFehler((FEHLER[antwort.fehler] ?? (() => m.fehler_speichern()))());
    nachSchritt(antwort.daten);
  };
  return {
    monat,
    setMonat: waehlen(setMonat),
    nutzerId,
    setNutzerId: waehlen(setNutzerId),
    personen,
    ansicht,
    fehler,
    meldung,
    setMeldung,
    /** the query of the time sheet's link: the month and person shown */
    abfrage: () =>
      ressourcen.monat({ monat: monat(), nutzerId: nutzerId() }).pfad.split("?")[1] ?? "",
    schritt,
    nachSchritt,
  };
};
