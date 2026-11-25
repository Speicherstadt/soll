import type { Stempelart } from "@soll/arbeitszeit";
import type { Ausweis } from "../typen.ts";

/**
 * The offline queue of a tablet terminal (S-803), as data: what an entry holds, what goes to the
 * server, what an answer means. The effects live in dienst.ts, the storage in ablage.ts.
 */

/** An entry of the queue: numbered per terminal, the credential only encrypted, signed */
export type KioskEintrag = {
  terminalId: string;
  nummer: number;
  art: Stempelart;
  geraetZeitpunkt: number;
  /** the credential, encrypted to the server's key (`ausweisVerschluesseln`) */
  ausweis: string;
  signatur: string;
};

/**
 * What may wait in the queue: every credential but the server's receipt after a SUN message, which
 * holds only 20 seconds (docs/plan.md, "Beleg nach der SUN-Nachricht")
 */
export type OfflineAusweis = Exclude<Ausweis, { beleg: string }>;

export const offlineAusweis = (ausweis: Ausweis): OfflineAusweis | null =>
  "beleg" in ausweis ? null : ausweis;

/** The entries in the order they were stamped */
export const nachNummer = (eintraege: readonly KioskEintrag[]): KioskEintrag[] =>
  [...eintraege].sort((a, b) => a.nummer - b.nummer);

/** The body of POST /api/v1/kiosk/offline, with the time of sending by the tablet's clock */
export const koerperFuer = (eintrag: KioskEintrag, gesendetAm: number) => ({
  nummer: eintrag.nummer,
  art: eintrag.art,
  geraetZeitpunkt: eintrag.geraetZeitpunkt,
  gesendetAm,
  ausweis: eintrag.ausweis,
  signatur: eintrag.signatur,
});

/**
 * What an answer means for an entry: taken (2xx, the same entry again too); try later (no network,
 * the server failing, the terminal locked or its module off, its key not yet registered); refused
 * for good (the server kept it with its reason, or the entry is wrong: it leaves the tablet, the
 * owner sees the refusal or the gap); or the terminal is revoked and sends nothing more
 */
export const folge = (
  status: number,
  fehler = "",
): "uebertragen" | "spaeter" | "abgelehnt" | "entkoppelt" => {
  if (status >= 200 && status < 300) return "uebertragen";
  if (status === 401) return "entkoppelt";
  if ([0, 403, 408, 423, 429].includes(status) || status >= 500) return "spaeter";
  if (status === 409 && fehler === "schluessel_fehlt") return "spaeter";
  return "abgelehnt";
};
