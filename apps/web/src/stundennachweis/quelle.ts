import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import type { NachweisKopf, NachweisWahl, Unterzeichnet, Vorschau } from "./typen.ts";

/** Signing locks bookings: the stopwatch's days and the reports load again, the preview empties */
const UNTERSCHREIBEN_AENDERT = [
  alle(PFAD.nachweise),
  alle(PFAD.nachweisVorschau),
  alle(PFAD.stoppuhr),
];

/**
 * The reports (a query) and the preview of the one chosen (a query per choice; none while no order
 * is chosen). Read under `<Loading>`.
 */
export const nachweisQuelle = (wahl: () => NachweisWahl | null) => {
  const liste = abfrage<{ nachweise: NachweisKopf[] }>(ressourcen.nachweise);
  const vorschau = abfrage<Vorschau>(() => {
    const gewaehlt = wahl();
    return gewaehlt ? ressourcen.nachweisVorschau(gewaehlt) : null;
  });
  return {
    nachweise: () => daten(liste.data)?.nachweise ?? [],
    vorschau: () => (wahl() ? (daten(vorschau.data) ?? null) : null),
    fehler: () => !liste.data.ok || (wahl() !== null && !vorschau.data.ok),
  };
};

export type NachweisQuelle = ReturnType<typeof nachweisQuelle>;

/** Signing a report: the preview's `stand` with what the customer gave; resolves with the answer */
export const nachweisUnterschreiben = () => {
  const senden = aenderung<NachweisWahl & Unterzeichnet & { stand: string }, NachweisKopf>(
    (body) => api<NachweisKopf>(PFAD.nachweise, { body }),
    () => UNTERSCHREIBEN_AENDERT,
    { immer: true },
  );
  return { arbeitet: () => senden.isPending, unterschreiben: senden.mutate };
};

/** Where the PDF of a report is downloaded */
export const pdfPfad = (nachweisId: string) => `${PFAD.nachweise}/${nachweisId}/pdf`;
