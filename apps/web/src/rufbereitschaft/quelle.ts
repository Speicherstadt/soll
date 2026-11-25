import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";

/*
 * Call-outs from a Rufbereitschaft (S-505) as the app reads and writes them; the server's clock
 * counts for a call-out begun or ended live, as for a stamp
 */

export type Dienst = { rufdienstId: string; tag: string; beginn: number; ende: number };
export type Einsatz = { einsatzId: string; beginn: number; ende: number | null };
export type EinsatzStand = {
  einsaetze: Einsatz[];
  laufend: Einsatz | null;
  /** the published duty that holds now */
  jetzt: Dienst | null;
  /** the published duties from yesterday to tomorrow */
  naechste: Dienst[];
};

/** What a call-out changes: itself, the day and the month it counts in */
const BETRIFFT = [alle(PFAD.einsaetze), alle(PFAD.monat), alle(PFAD.tag)];

export const einsatzStand = () => {
  const stand = abfrage<EinsatzStand>(() => ressourcen.einsaetze({}));
  return () => daten(stand.data);
};

export const einsatzAktionen = () => ({
  beginnen: aenderung(
    () => api("/api/v1/arbeitszeit/einsaetze/beginnen", { body: {} }),
    () => BETRIFFT,
  ),
  beenden: aenderung(
    () => api("/api/v1/arbeitszeit/einsaetze/beenden", { body: {} }),
    () => BETRIFFT,
  ),
  nachtragen: aenderung(
    (eingabe: { beginn: number; ende: number; grund: string }) =>
      api("/api/v1/arbeitszeit/einsaetze", { body: eingabe }),
    () => BETRIFFT,
  ),
});

const FEHLER: Record<string, () => string> = {
  keine_rufbereitschaft: () => m.callout_error_none(),
  ueberschneidung: () => m.callout_error_overlap(),
  zukunft: () => m.callout_error_future(),
  monat_gesperrt: () => m.callout_error_locked(),
};

export const einsatzFehler = (fehler: string): string =>
  (FEHLER[fehler] ?? (() => m.fehler_speichern()))();
