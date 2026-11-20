import { darf } from "../../auth/rollen.ts";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { schreiben } from "../audit/index.ts";
import { mitgliedschaftVon } from "../mitglieder/index.ts";
import { personVonPin } from "../pin/index.ts";
import { personVonAusweis } from "./ausweise.ts";
import { pinKennung } from "./geheimnis.ts";
import {
  istGesperrt,
  mussZuruecksetzen,
  nachFehlversuch,
  OHNE_SPERRE,
  type Sperrstand,
} from "./sperre.ts";
import { type Terminal, terminalAkteur, terminalLesen } from "./terminals.ts";

/** What identifies a person at the terminal: the PIN alone or the value of the QR code */
export type Ausweis = { pin: string } | { qr: string };

export type Erkennung =
  | { ok: true; nutzerId: string }
  | { ok: false; grund: "gesperrt"; gesperrtBis: number }
  | { ok: false; grund: "unbekannt"; fehlversuche: number };

const sperrstand = (t: Terminal): Sperrstand => ({
  fehlversuche: t.fehlversuche,
  sperren: t.sperren,
  gesperrtBis: t.gesperrtBis,
});

/** A member who stamps (S-304): someone who left, external staff and devices are nobody here */
const stempelt = (db: Db, betriebId: string, nutzerId: string | undefined): nutzerId is string => {
  if (nutzerId === undefined) return false;
  const mitglied = mitgliedschaftVon(db, betriebId, nutzerId);
  return mitglied !== undefined && darf(mitglied.rolle, "stempeln");
};

const personVon = (db: Db, terminal: Terminal, ausweis: Ausweis, schluessel: Uint8Array) =>
  "pin" in ausweis
    ? personVonPin(db, terminal.betriebId, pinKennung(schluessel, terminal.betriebId, ausweis.pin))
    : personVonAusweis(db, terminal.betriebId, ausweis.qr);

/**
 * Recognises a person at a terminal by PIN or QR code (S-801). A locked terminal compares nothing;
 * each wrong try counts toward the lock of the terminal (sperre.ts) and stands in the audit chain,
 * a person recognised ends the count. The count is read again inside the write transaction, which
 * holds the write lock, so parallel wrong tries are not lost (as in modules/pin).
 */
export const erkennen = (
  db: Db,
  schreibDb: SchreibDb,
  terminal: Terminal,
  ausweis: Ausweis,
  pinSchluessel: Uint8Array,
  jetzt: number,
): Erkennung => {
  if (istGesperrt(sperrstand(terminal), jetzt))
    return { ok: false, grund: "gesperrt", gesperrtBis: terminal.gesperrtBis ?? jetzt };
  const nutzerId = personVon(db, terminal, ausweis, pinSchluessel);
  const erkannt = stempelt(db, terminal.betriebId, nutzerId);
  const kontext = {
    betriebId: terminal.betriebId,
    akteur: terminalAkteur(terminal.terminalId),
    jetzt,
  };
  return schreiben(schreibDb, kontext, (s): Erkennung => {
    const aktuell = terminalLesen(db, terminal.betriebId, terminal.terminalId) ?? terminal;
    const stand = sperrstand(aktuell);
    if (istGesperrt(stand, jetzt))
      return { ok: false, grund: "gesperrt", gesperrtBis: stand.gesperrtBis ?? jetzt };
    if (erkannt) {
      if (mussZuruecksetzen(stand))
        s.aendern("terminals", { terminalId: terminal.terminalId }, OHNE_SPERRE);
      return { ok: true, nutzerId };
    }
    const neu = nachFehlversuch(stand, jetzt);
    s.aendern("terminals", { terminalId: terminal.terminalId }, neu);
    return neu.gesperrtBis !== null && neu.gesperrtBis > jetzt
      ? { ok: false, grund: "gesperrt", gesperrtBis: neu.gesperrtBis }
      : { ok: false, grund: "unbekannt", fehlversuche: neu.fehlversuche };
  });
};
