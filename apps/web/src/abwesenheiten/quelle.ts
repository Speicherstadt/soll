import { createSignal } from "solid-js";
import { type Antwort, api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { fehlerText } from "./text.ts";
import type { Liste, Offen, TeamEintrag } from "./typen.ts";

export const BASIS = "/api/v1/arbeitszeit/abwesenheiten";

/** The next four weeks from today, for the team */
const teamZeitraum = (heute: string) => {
  const bis = new Date(Date.parse(`${heute}T12:00:00Z`) + 27 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return new URLSearchParams({ von: heute, bis }).toString();
};

/**
 * The state of the absences page: one's own absences of the year, what waits for the caller's
 * decision or a certificate, the team, and the steps with what they report
 */
export const abwesenheitQuelle = () => {
  const [liste, setListe] = createSignal<Liste | null>(null);
  const [offen, setOffen] = createSignal<Offen | null>(null);
  const [team, setTeam] = createSignal<TeamEintrag[]>([]);
  const [fehler, setFehler] = createSignal("");
  const [meldung, setMeldung] = createSignal("");

  const laden = async () => {
    const antwort = await api<Liste>(BASIS);
    if (!antwort.ok) return setFehler(m.laden_fehler());
    setFehler("");
    setListe(antwort.daten);
    const { rechte, heute } = antwort.daten;
    const [neuOffen, neuTeam] = await Promise.all([
      rechte.freigeben || rechte.gesundheit ? api<Offen>(`${BASIS}/offen`) : null,
      api<{ abwesenheiten: TeamEintrag[] }>(`${BASIS}/team?${teamZeitraum(heute)}`),
    ]);
    setOffen(neuOffen?.ok ? neuOffen.daten : null);
    setTeam(neuTeam.ok ? neuTeam.daten.abwesenheiten : []);
  };
  void laden();

  /** Sends a step and loads again; the answer's error in words, or the message on success */
  const senden = async <T>(
    anfrage: Promise<Antwort<T>>,
    erfolg: (daten: T) => string = () => "",
  ): Promise<boolean> => {
    const antwort = await anfrage;
    if (!antwort.ok) {
      setMeldung("");
      setFehler(fehlerText(antwort.fehler));
      return false;
    }
    setFehler("");
    setMeldung(erfolg(antwort.daten));
    await laden();
    return true;
  };

  return { liste, offen, team, fehler, meldung, laden, senden };
};

export type AbwesenheitQuelle = ReturnType<typeof abwesenheitQuelle>;
