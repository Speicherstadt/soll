import { createSignal } from "solid-js";
import { abfrage, schreiben } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import type { Antwort } from "../api.ts";
import { fehlerText } from "./text.ts";
import type { Liste } from "./typen.ts";

export const BASIS = PFAD.abwesenheiten;

/**
 * What a step on an absence changes: the absences, and the day, the month and the plan's week that
 * count or show them (Soll, R-24, „abwesend“ in the plan)
 */
export const ABWESENHEIT_AENDERT = [
  alle(PFAD.abwesenheiten),
  alle(PFAD.abwesenheitenOffen),
  alle(PFAD.abwesenheitenTeam),
  alle(PFAD.tag),
  alle(PFAD.monat),
  alle(PFAD.woche),
];

/** The next four weeks from today, for the team */
export const teamZeitraum = (heute: string) => ({
  von: heute,
  bis: new Date(Date.parse(`${heute}T12:00:00Z`) + 27 * 86_400_000).toISOString().slice(0, 10),
});

/**
 * The state of the absences page: one's own absences of the year (a query), and the steps with what
 * they report; the requests waiting for a decision and the team are queries of their cards
 */
export const abwesenheitQuelle = () => {
  const liste = abfrage<Liste>(ressourcen.abwesenheiten);
  const [fehler, setFehler] = createSignal("");
  const [meldung, setMeldung] = createSignal("");
  const schritt = schreiben(() => ABWESENHEIT_AENDERT);

  /** Sends a step; the answer's error in words, or the message on success, once the data is fresh */
  const senden = async <T>(
    auftrag: () => Promise<Antwort<T>>,
    erfolg: (daten: T) => string = () => "",
  ): Promise<boolean> => {
    const antwort = (await schritt.mutate(auftrag)) as Antwort<T>;
    if (!antwort.ok) {
      setMeldung("");
      setFehler(fehlerText(antwort.fehler));
      return false;
    }
    setFehler("");
    setMeldung(erfolg(antwort.daten));
    return true;
  };

  return { liste, fehler, meldung, senden, arbeitet: () => schritt.isPending };
};

export type AbwesenheitQuelle = ReturnType<typeof abwesenheitQuelle>;
