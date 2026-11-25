import { darf } from "../../auth/rollen.ts";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { schreiben } from "../audit/index.ts";
import { mitgliedschaftVon } from "../mitglieder/index.ts";
import { personVonPin } from "../pin/index.ts";
import { personVonAusweis } from "./ausweise.ts";
import { belegPruefen } from "./beleg.ts";
import { pinKennung, type TerminalSchluessel, uidNormalisieren } from "./geheimnis.ts";
import { karteVonSun, karteVonUid } from "./karten.ts";
import { lesungMerken, wiederholt } from "./lesungen.ts";
import { istGesperrt, nachFehlversuch, offlineGesperrt, type Sperrstand } from "./sperre.ts";
import type { Sun } from "./sun.ts";
import { type Terminal, terminalAkteur, terminalLesen } from "./terminals.ts";

/**
 * What identifies a person at the terminal: the PIN alone, the value of the QR code, a card's UID
 * with the person's PIN, the SUN message of an NTAG 424 DNA, or the receipt of one (beleg.ts)
 */
export type Ausweis =
  | { pin: string }
  | { qr: string }
  | { karte: string; pin: string }
  | { sun: Sun }
  | { beleg: string };

export type Erkennung =
  | { ok: true; nutzerId: string }
  /** `gezaehlt`: this try was compared and counted, and it locked the terminal */
  | { ok: false; grund: "gesperrt"; gesperrtBis: number; gezaehlt?: true }
  | { ok: false; grund: "unbekannt"; fehlversuche: number };

/** Who an identification names, and for a SUN message the card's read counter to take over */
type Treffer = { nutzerId?: string | undefined; zaehler?: { karteId: string; wert: number } };

const sperrstand = (t: Terminal): Sperrstand => ({
  fehlversuche: t.fehlversuche,
  sperren: t.sperren,
  gesperrtBis: t.gesperrtBis,
  fehlerTag: t.fehlerTag,
});

/** A member who stamps (S-304): someone who left, external staff and devices are nobody here */
const stempelt = (db: Db, betriebId: string, nutzerId: string | undefined): nutzerId is string => {
  if (nutzerId === undefined) return false;
  const mitglied = mitgliedschaftVon(db, betriebId, nutzerId);
  return mitglied !== undefined && darf(mitglied.rolle, "stempeln");
};

const pinPerson = (db: Db, betriebId: string, pin: string, schluessel: TerminalSchluessel) =>
  personVonPin(db, betriebId, pinKennung(schluessel.pin, betriebId, pin));

/** A card's UID counts only with the PIN of the card's own person: a UID can be copied (S-802) */
const kartePerson = (
  db: Db,
  betriebId: string,
  ausweis: { karte: string; pin: string },
  schluessel: TerminalSchluessel,
): string | undefined => {
  const uid = uidNormalisieren(ausweis.karte);
  const karte = uid === null ? undefined : karteVonUid(db, schluessel, betriebId, uid);
  if (!karte) return undefined;
  return pinPerson(db, betriebId, ausweis.pin, schluessel) === karte.nutzerId
    ? karte.nutzerId
    : undefined;
};

const trefferVon = (
  db: Db,
  terminal: Terminal,
  ausweis: Ausweis,
  schluessel: TerminalSchluessel,
  jetzt: number,
): Treffer => {
  const { betriebId } = terminal;
  if ("karte" in ausweis) return { nutzerId: kartePerson(db, betriebId, ausweis, schluessel) };
  if ("pin" in ausweis) return { nutzerId: pinPerson(db, betriebId, ausweis.pin, schluessel) };
  if ("qr" in ausweis) return { nutzerId: personVonAusweis(db, betriebId, ausweis.qr) };
  if ("beleg" in ausweis)
    return { nutzerId: belegPruefen(schluessel.beleg, ausweis.beleg, terminal.terminalId, jetzt) };
  const gefunden = karteVonSun(db, schluessel, betriebId, ausweis.sun);
  return gefunden
    ? {
        nutzerId: gefunden.karte.nutzerId,
        zaehler: { karteId: gefunden.karte.karteId, wert: gefunden.zaehler },
      }
    : {};
};

/**
 * Whether the terminal's lock stops this try: online any lock; for an entry of the offline queue
 * only the lock until midnight, and only for a credential that can be guessed (sperre.ts)
 */
const gesperrt = (stand: Sperrstand, jetzt: number, ausweis: Ausweis, offline?: number) =>
  offline === undefined
    ? istGesperrt(stand, jetzt)
    : offlineGesperrt(stand, jetzt, "pin" in ausweis);

/**
 * Recognises a person at a terminal (S-801, S-802). A locked terminal compares nothing; each wrong
 * try, a card without its person's PIN and a forged or replayed SUN message included, counts toward
 * the lock of the terminal (sperre.ts) and stands in the audit chain; a person recognised lifts
 * nothing, so one's own PIN between guesses does not reset the count. The count and a card's read
 * counter are read again inside the write transaction, which holds the write lock, so parallel
 * tries are not lost and one SUN message cannot count twice (as in modules/pin). `offline` is the
 * instant of an entry from the tablet's offline queue (S-803): it changes how the lock and an older
 * SUN counter count (sperre.ts, lesungen.ts).
 */
export const erkennen = (
  db: Db,
  schreibDb: SchreibDb,
  terminal: Terminal,
  ausweis: Ausweis,
  schluessel: TerminalSchluessel,
  jetzt: number,
  offline?: number,
): Erkennung => {
  if (gesperrt(sperrstand(terminal), jetzt, ausweis, offline))
    return { ok: false, grund: "gesperrt", gesperrtBis: terminal.gesperrtBis ?? jetzt };
  const treffer = trefferVon(db, terminal, ausweis, schluessel, jetzt);
  const erkannt = stempelt(db, terminal.betriebId, treffer.nutzerId);
  const kontext = {
    betriebId: terminal.betriebId,
    akteur: terminalAkteur(terminal.terminalId),
    jetzt,
  };
  return schreiben(schreibDb, kontext, (s): Erkennung => {
    const aktuell = terminalLesen(db, terminal.betriebId, terminal.terminalId) ?? terminal;
    const stand = sperrstand(aktuell);
    if (gesperrt(stand, jetzt, ausweis, offline))
      return { ok: false, grund: "gesperrt", gesperrtBis: stand.gesperrtBis ?? jetzt };
    if (erkannt && !wiederholt(db, terminal.betriebId, treffer.zaehler, offline)) {
      if (treffer.zaehler)
        lesungMerken(db, s, terminal.betriebId, treffer.zaehler, offline ?? jetzt);
      return { ok: true, nutzerId: treffer.nutzerId as string };
    }
    const neu = nachFehlversuch(stand, jetzt);
    s.aendern("terminals", { terminalId: terminal.terminalId }, neu);
    return neu.gesperrtBis !== null && neu.gesperrtBis > jetzt
      ? { ok: false, grund: "gesperrt", gesperrtBis: neu.gesperrtBis, gezaehlt: true }
      : { ok: false, grund: "unbekannt", fehlversuche: neu.fehlversuche };
  });
};
