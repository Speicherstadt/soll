import type { Offlineeintrag } from "@soll/arbeitszeit";
import type { Stempel } from "../zeiten/typen.ts";

/**
 * The offline queue of a device (S-305), as data: what waits, how an entry goes to the server, what
 * an answer means, and how a waiting entry shows on Heute. The effects live in dienst.ts.
 */

/** A person in a business on this device: the queue and the key belong to one */
export type Konto = { betriebId: string; nutzerId: string };

export const kontoSchluessel = (konto: Konto): string => `${konto.betriebId}/${konto.nutzerId}`;

/** An entry of the queue: signed on the device, kept until the server took it */
export type Eintrag = Offlineeintrag & {
  konto: string;
  signatur: string;
  /** the server refused it (e.g. `doppelt`, `abgeschlossen`): it stays visible and is not sent again */
  abgelehnt: string | null;
};

const nachNummer = (a: Eintrag, b: Eintrag) => a.nummer - b.nummer;

/** The entries still to send, in the order they were stamped */
export const wartende = (eintraege: readonly Eintrag[]): Eintrag[] =>
  eintraege.filter((eintrag) => eintrag.abgelehnt === null).sort(nachNummer);

/** The entries the server refused, for the person to see */
export const abgelehnte = (eintraege: readonly Eintrag[]): Eintrag[] =>
  eintraege.filter((eintrag) => eintrag.abgelehnt !== null).sort(nachNummer);

/**
 * The call for an entry: the entry just stamped goes live (the server's clock counts), every other
 * one as an offline entry with the device's time and the time of sending
 */
export const anfrageFuer = (
  eintrag: Eintrag,
  live: boolean,
  gesendetAm: number,
): { pfad: string; body: Record<string, unknown> } => {
  const geraet = { geraetId: eintrag.geraetId, nummer: eintrag.nummer, signatur: eintrag.signatur };
  const basis = { art: eintrag.art, geraetZeitpunkt: eintrag.geraetZeitpunkt, geraet };
  return live
    ? { pfad: "/api/v1/arbeitszeit/stempelungen", body: basis }
    : { pfad: "/api/v1/arbeitszeit/stempelungen/offline", body: { ...basis, gesendetAm } };
};

/**
 * What an answer means for the entry: taken (2xx, also the same entry again), wait and try later
 * (no network, signed out, no right just now, the server failing, or a session that does not know
 * the device: another person or business signed in meanwhile, e.g. from a tab left open on a shared
 * browser), or refused for good (the server named what is wrong with this entry)
 */
export const folge = (status: number, fehler = ""): "uebertragen" | "spaeter" | "abgelehnt" => {
  if (status >= 200 && status < 300) return "uebertragen";
  if (status === 0 || status === 401 || status === 403 || status === 408 || status === 429)
    return "spaeter";
  if (fehler === "geraet_unbekannt") return "spaeter";
  return status >= 500 ? "spaeter" : "abgelehnt";
};

/** A stamp of Heute that has not reached the server yet */
export type WartenderStempel = Stempel & { wartend: true };

/**
 * The waiting entries as stamps of the person, at the device's time moved by the distance to the
 * server's clock last seen, so Heute counts the state on while there is no network (never a stamp
 * Soll makes itself: only what the person tapped)
 */
export const alsStempel = (
  eintraege: readonly Eintrag[],
  nutzerId: string,
  abstand: number,
): WartenderStempel[] =>
  wartende(eintraege).map((eintrag) => ({
    stempelId: `wartend-${eintrag.geraetId}-${eintrag.nummer}`,
    nutzerId,
    art: eintrag.art,
    zeitpunkt: eintrag.geraetZeitpunkt + abstand,
    geraetZeitpunkt: eintrag.geraetZeitpunkt,
    quelle: "app",
    offline: true,
    nummer: eintrag.nummer,
    korrigiert: false,
    wartend: true,
  }));
