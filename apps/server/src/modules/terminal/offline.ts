import {
  ausweisZusatz,
  nummernLuecken,
  offlineZeitpunkt,
  type Stempelart,
  terminalNachricht,
} from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { terminalEintraege } from "../../db/schema.ts";
import {
  type OeffentlicherSchluessel,
  offlineStempeln,
  schluesselPruefen,
  signaturGueltig,
  stempelungenIn,
} from "../arbeitszeit/index.ts";
import { sha256 } from "../audit/hash.ts";
import { schreiben } from "../audit/index.ts";
import { type Ausweis, erkennen } from "./erkennen.ts";
import type { TerminalSchluessel } from "./geheimnis.ts";
import { ausweisOeffnen } from "./offline-schluessel.ts";
import { type Terminal, terminalAkteur, terminalLesen } from "./terminals.ts";

/**
 * The offline queue of a tablet terminal (S-803): the tablet registers the public half of its
 * non-extractable key once per pairing, then sends what it took while the server was out of reach.
 * Each entry is checked against that key, numbered per terminal, and its credential, encrypted to
 * the server, recognises the person as at the online kiosk (docs/plan.md, "Warteschlange am
 * Terminal").
 */

export type SchluesselErgebnis =
  | { ok: true; neu: boolean }
  | { ok: false; grund: "schluessel_ungueltig" | "vergeben" };

/**
 * Registers the tablet's public key, once: again with the same key changes nothing, another key is
 * refused, so nobody with the device token swaps the key the waiting entries are checked against
 */
export const terminalSchluesselAnmelden = async (
  db: Db,
  schreibDb: SchreibDb,
  terminal: Terminal,
  schluessel: OeffentlicherSchluessel,
  jetzt: number,
): Promise<SchluesselErgebnis> => {
  const text = await schluesselPruefen(schluessel);
  if (!text) return { ok: false, grund: "schluessel_ungueltig" };
  // synchronous from here: no other write comes between reading and writing
  const aktuell = terminalLesen(db, terminal.betriebId, terminal.terminalId) ?? terminal;
  if (aktuell.schluessel !== null)
    return aktuell.schluessel === text
      ? { ok: true, neu: false }
      : { ok: false, grund: "vergeben" };
  const kontext = {
    betriebId: terminal.betriebId,
    akteur: terminalAkteur(terminal.terminalId),
    jetzt,
  };
  schreiben(schreibDb, kontext, (s) =>
    s.aendern("terminals", { terminalId: terminal.terminalId }, { schluessel: text }),
  );
  return { ok: true, neu: true };
};

/** An entry as the tablet sends it */
export type OfflineEingabe = {
  nummer: number;
  art: Stempelart;
  geraetZeitpunkt: number;
  gesendetAm: number;
  /** the credential, encrypted to the server (`ausweisVerschluesseln`) */
  ausweis: string;
  signatur: string;
};

/** Why an entry with a valid signature made no stamp; it is kept, the owner sees it */
export type Ablehnung =
  | "ausweis_unlesbar"
  | "ausweis_unbekannt"
  | "gesperrt"
  | "zukunft"
  | "abgeschlossen";

export type OfflineErgebnis =
  /** `vorhanden`: the same entry came before; this is its answer again */
  | { art: "gestempelt"; stempelId: string; vorhanden: boolean }
  | { art: "abgelehnt"; grund: Ablehnung; vorhanden: boolean }
  /** not taken now: kept on the tablet (schluessel_fehlt) or wrong for good */
  | { art: "fehler"; fehler: "signatur" | "schluessel_fehlt" | "doppelt" };

type EintragZeile = typeof terminalEintraege.$inferSelect;

const eintragLesen = (db: Db, betriebId: string, terminalId: string, nummer: number) =>
  db
    .select()
    .from(terminalEintraege)
    .where(
      and(
        eq(terminalEintraege.betriebId, betriebId),
        eq(terminalEintraege.terminalId, terminalId),
        eq(terminalEintraege.nummer, nummer),
      ),
    )
    .get();

/** The answer an entry got the first time, for the same entry sent again */
const wieVorher = (zeile: EintragZeile): OfflineErgebnis =>
  zeile.stempelId !== null
    ? { art: "gestempelt", stempelId: zeile.stempelId, vorhanden: true }
    : { art: "abgelehnt", grund: zeile.grund as Ablehnung, vorhanden: true };

/**
 * How long after the tap a live stamp of the same person and kind from a terminal is the same tap:
 * the kiosk queues a stamp whose online answer it did not get, and the server may have stamped it
 * (review of S-803)
 */
export const SELBER_TIPP_MS = 60_000;

/** A live terminal stamp of the person, of this kind, from the tap to a minute after it */
const schonLive = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  art: Stempelart,
  getippt: number,
): string | undefined =>
  stempelungenIn(db, betriebId, nutzerId, getippt - 5_000, getippt + SELBER_TIPP_MS).find(
    (stempel) => stempel.quelle === "terminal" && !stempel.offline && stempel.art === art,
  )?.stempelId;

/** The parts of an entry the server keeps: number, kind, the device's time and the hash */
const zeileVon = (terminal: Terminal, eingabe: OfflineEingabe, hash: string, jetzt: number) => ({
  betriebId: terminal.betriebId,
  terminalId: terminal.terminalId,
  nummer: eingabe.nummer,
  inhaltHash: hash,
  art: eingabe.art,
  geraetZeitpunkt: eingabe.geraetZeitpunkt,
  empfangenAm: jetzt,
});

export type OfflineAbhaengigkeiten = {
  db: Db;
  schreibDb: SchreibDb;
  schluessel: TerminalSchluessel;
  jetzt: () => number;
  /** the credential once opened, checked at the boundary (Zod in the route); null when invalid */
  ausweisAus: (klartext: string) => Exclude<Ausweis, { beleg: string }> | null;
};

/**
 * Takes an entry of a terminal's offline queue. The signature over the whole entry, credential
 * included, is checked against the terminal's key; a number already taken answers as it did before
 * (the same content) or is refused (another content). Then the credential is opened and recognises
 * the person as online (`erkennen`: a wrong one counts toward the lock and stands in the audit
 * chain, a SUN message counts once); the stamp is the person's, from the terminal, marked offline,
 * at the device's time moved by the error of its clock. Nothing waits on a lock: a guessable
 * credential after the day's last wrong try is refused as `gesperrt` (sperre.ts). A live stamp of the
 * same tap (its answer was lost) is taken as this entry's stamp. Refusals with a valid signature are
 * kept with their reason.
 */
export const offlineEintragAnnehmen = async (
  abh: OfflineAbhaengigkeiten,
  terminal: Terminal,
  eingabe: OfflineEingabe,
): Promise<OfflineErgebnis> => {
  const { db, schreibDb } = abh;
  const aktuell = terminalLesen(db, terminal.betriebId, terminal.terminalId) ?? terminal;
  if (aktuell.schluessel === null) return { art: "fehler", fehler: "schluessel_fehlt" };
  const nachricht = terminalNachricht({ terminalId: terminal.terminalId, ...eingabe });
  if (!(await signaturGueltig(aktuell.schluessel, nachricht, eingabe.signatur)))
    return { art: "fehler", fehler: "signatur" };
  // synchronous from here: one entry cannot be taken twice by two calls at once
  const hash = sha256(nachricht);
  const vorher = eintragLesen(db, terminal.betriebId, terminal.terminalId, eingabe.nummer);
  if (vorher)
    return vorher.inhaltHash === hash ? wieVorher(vorher) : { art: "fehler", fehler: "doppelt" };
  const jetzt = abh.jetzt();
  const zeile = zeileVon(terminal, eingabe, hash, jetzt);
  const ablehnen = (grund: Ablehnung): OfflineErgebnis => {
    const kontext = {
      betriebId: terminal.betriebId,
      akteur: terminalAkteur(terminal.terminalId),
      jetzt,
    };
    schreiben(schreibDb, kontext, (s) => s.einfuegen("terminalEintraege", { ...zeile, grund }));
    return { art: "abgelehnt", grund, vorhanden: false };
  };
  const klartext = ausweisOeffnen(
    abh.schluessel.ausweis.privat,
    eingabe.ausweis,
    ausweisZusatz({ terminalId: terminal.terminalId, ...eingabe }),
  );
  const ausweis = klartext === null ? null : abh.ausweisAus(klartext);
  if (!ausweis) return ablehnen("ausweis_unlesbar");
  const zeit = offlineZeitpunkt({ ...eingabe, empfangen: jetzt });
  if (!zeit.ok) return ablehnen("zukunft");
  const erkannt = erkennen(db, schreibDb, aktuell, ausweis, abh.schluessel, jetzt, zeit.zeitpunkt);
  if (!erkannt.ok)
    return ablehnen(
      erkannt.grund === "gesperrt" && !erkannt.gezaehlt ? "gesperrt" : "ausweis_unbekannt",
    );
  // the person stamps, through the terminal: they are the actor, the row names the terminal
  const kontext = { betriebId: terminal.betriebId, akteur: erkannt.nutzerId, jetzt };
  const live = schonLive(db, terminal.betriebId, erkannt.nutzerId, eingabe.art, zeit.zeitpunkt);
  if (live) {
    schreiben(schreibDb, kontext, (s) =>
      s.einfuegen("terminalEintraege", { ...zeile, stempelId: live, grund: null }),
    );
    return { art: "gestempelt", stempelId: live, vorhanden: true };
  }
  const ergebnis = offlineStempeln(
    db,
    schreibDb,
    kontext,
    {
      art: eingabe.art,
      geraetZeitpunkt: eingabe.geraetZeitpunkt,
      gesendetAm: eingabe.gesendetAm,
      quelle: "terminal",
      terminalId: terminal.terminalId,
    },
    (s, stempel) =>
      s.einfuegen("terminalEintraege", { ...zeile, stempelId: stempel.stempelId, grund: null }),
  );
  if (!ergebnis.ok) return ablehnen(ergebnis.grund === "zukunft" ? "zukunft" : "abgeschlossen");
  return { art: "gestempelt", stempelId: ergebnis.stempel.stempelId, vorhanden: false };
};

/** What the owner sees of a terminal's queue: gaps in its numbers and the entries refused */
export type OfflineStand = {
  luecken: { von: number; bis: number }[];
  abgelehnt: {
    nummer: number;
    grund: string;
    art: string;
    geraetZeitpunkt: number;
    empfangenAm: number;
  }[];
};

export const offlineStand = (db: Db, betriebId: string, terminalId: string): OfflineStand => {
  const zeilen = db
    .select()
    .from(terminalEintraege)
    .where(
      and(eq(terminalEintraege.betriebId, betriebId), eq(terminalEintraege.terminalId, terminalId)),
    )
    .orderBy(terminalEintraege.nummer)
    .all();
  return {
    luecken: nummernLuecken(zeilen.map((zeile) => zeile.nummer)),
    abgelehnt: zeilen.flatMap((zeile) =>
      zeile.grund === null
        ? []
        : [
            {
              nummer: zeile.nummer,
              grund: zeile.grund,
              art: zeile.art,
              geraetZeitpunkt: zeile.geraetZeitpunkt,
              empfangenAm: zeile.empfangenAm,
            },
          ],
    ),
  };
};
