import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import type {
  HabenKontakt,
  HabenZugang,
  UebergabeListe,
  UebergabeWahl,
  UebergabeZeile,
} from "./typen.ts";

/** At most this many bookings per transfer (the server's limit: Haben takes 120 calls a minute) */
export const HOECHSTENS = 100;

/** The access (a query) */
export const habenQuelle = () => {
  const zugang = abfrage<{ zugang: HabenZugang | null }>(ressourcen.habenZugang);
  return {
    zugang: () => daten(zugang.data)?.zugang ?? null,
    zugangFehler: () => !zugang.data.ok,
  };
};

/** The contacts in Haben; each load asks Haben, so only asked while the access is shown kept */
export const kontakteQuelle = () => {
  const kontakte = abfrage<{ kontakte: HabenKontakt[] }>(ressourcen.habenKontakte);
  return {
    kontakte: () => daten(kontakte.data)?.kontakte ?? [],
    /** why the contacts could not be read: Soll's code for Haben's failure, or "" */
    fehler: () => (kontakte.data.ok ? "" : kontakte.data.fehler),
  };
};

/** The bookings of the chosen order and span with their state towards Haben */
export const uebergabeQuelle = (wahl: () => UebergabeWahl | null) => {
  const liste = abfrage<UebergabeListe>(() => {
    const gewaehlt = wahl();
    return gewaehlt ? ressourcen.habenBuchungen(gewaehlt) : null;
  });
  return {
    liste: () => (wahl() ? (daten(liste.data) ?? null) : null),
    fehler: () => wahl() !== null && !liste.data.ok,
  };
};

const ZUGANG_AENDERT = [alle(PFAD.habenZugang), alle(PFAD.habenKontakte)];

export const zugangSpeichern = () =>
  aenderung<{ adresse: string; token?: string }, { zugang: HabenZugang }>(
    (body) => api(PFAD.habenZugang, { method: "PUT", body }),
    () => ZUGANG_AENDERT,
  );

export const zugangEntfernen = () =>
  aenderung<void, null>(
    () => api(PFAD.habenZugang, { method: "DELETE" }),
    () => ZUGANG_AENDERT,
  );

/** Links a contact with a customer, or takes it over as a new one; the customers load again */
export const kontaktVerbinden = () =>
  aenderung<{ kontaktId: string; kundeId: string }, unknown>(
    ({ kontaktId, kundeId }) =>
      api(`${PFAD.habenKontakte}/${kontaktId}`, { body: kundeId ? { kundeId } : {} }),
    () => [alle(PFAD.habenKontakte), alle(PFAD.kunden), alle(PFAD.habenBuchungen)],
  );

/**
 * Hands bookings over: they are billed then, so the lists, the orders' budgets and the stopwatch's
 * days load again, also after a refusal (some may have been billed and wait for Haben)
 */
export const uebergeben = () =>
  aenderung<string[], { buchungen: Pick<UebergabeZeile, "buchungId" | "stand" | "fehler">[] }>(
    (buchungIds) => api(PFAD.habenUebergabe, { body: { buchungIds } }),
    () => [alle(PFAD.habenBuchungen), alle(PFAD.projekte), alle(PFAD.stoppuhr)],
    { immer: true },
  );
