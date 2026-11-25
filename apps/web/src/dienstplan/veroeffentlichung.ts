import { createSignal } from "solid-js";
import { aenderung } from "../abfragen/abfrage.ts";
import { m } from "../paraglide/messages.js";
import { PLAN_AENDERT, wocheVeroeffentlichen } from "./quelle.ts";

type Woche = { ort: string; am: string };

/**
 * Publishing the week shown (S-503): the drafts go out and the week loads again. What it reports
 * belongs to the week it was for, so it is gone once another week or site shows.
 */
export const veroeffentlichung = (setFehler: (text: string) => void) => {
  const [bericht, setBericht] = createSignal<{ woche: Woche; text: string } | null>(null);
  const schreiben = aenderung(
    ({ ort, am }: Woche) => wocheVeroeffentlichen(ort, am),
    () => PLAN_AENDERT,
  );
  const veroeffentlichen = async (woche: Woche) => {
    const antwort = await schreiben.mutate(woche);
    setFehler(antwort.ok ? "" : m.fehler_speichern());
    setBericht(
      antwort.ok
        ? {
            woche,
            text: m.plan_veroeffentlicht({
              anzahl: antwort.daten.anzahl,
              personen: antwort.daten.benachrichtigt,
            }),
          }
        : null,
    );
  };
  /** What the last publish of this week reported, else nothing */
  const gemeldet = (woche: Woche): string => {
    const letzter = bericht();
    return letzter && letzter.woche.ort === woche.ort && letzter.woche.am === woche.am
      ? letzter.text
      : "";
  };
  return { veroeffentlichen, gemeldet, laeuft: () => schreiben.isPending };
};
