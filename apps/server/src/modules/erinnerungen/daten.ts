import { darf } from "../../auth/rollen.ts";
import type { Db } from "../../db/oeffnen.ts";
import { monatStatus, stempelungenIn } from "../arbeitszeit/index.ts";
import { zustellbar } from "../mail/index.ts";
import { adresseVon, mitgliederMitNamen } from "../mitglieder/index.ts";
import { abosVon, type GespeichertesAbo } from "./abos.ts";
import { wuenscheVon } from "./einstellungen.ts";
import { type PersonDaten, type Vormonat, vormonatVon } from "./faellig.ts";

/*
 * What the reminder loop reads for one business (S-307): the people who stamp and can be reached,
 * with their wishes, the stamps of the last days and, on demand, their last month.
 */

/** The stamps a running shift needs: it lasts at most 24 hours, its working day began before */
const RUECKBLICK = 2 * 24 * 60 * 60 * 1000;

export type Erreichbar = PersonDaten & { abos: GespeichertesAbo[]; adresse: string | null };

const vormonat = (db: Db, betriebId: string, nutzerId: string, jetzt: number): Vormonat => {
  const monat = vormonatVon(jetzt);
  const status = monatStatus(db, betriebId, nutzerId, monat, jetzt);
  return {
    monat,
    aufgezeichnet: status.inhalt.tage.some((tag) => tag.stempel.length > 0),
    bestaetigt: status.bestaetigung?.gueltig === true,
    abgeschlossen: status.abschluss !== null,
  };
};

/**
 * The people of a business who stamp and have a way to be reached: a device with Web Push, or mail
 * (configured, wished and an address that receives it); nobody else is asked for anything
 */
export const personenDaten = (
  db: Db,
  geheimerSchluessel: Uint8Array,
  betriebId: string,
  jetzt: number,
  mitMail: boolean,
): Erreichbar[] =>
  mitgliederMitNamen(db, betriebId)
    .filter((mitglied) => darf(mitglied.rolle, "stempeln"))
    .flatMap(({ nutzerId }) => {
      const wuensche = wuenscheVon(db, betriebId, nutzerId);
      const abos = abosVon(db, geheimerSchluessel, betriebId, nutzerId);
      const roh = mitMail && wuensche.mail ? adresseVon(db, nutzerId) : null;
      const adresse = zustellbar(roh) ? roh : null;
      if (abos.length === 0 && adresse === null) return [];
      return [
        {
          nutzerId,
          wuensche,
          abos,
          adresse,
          stempelungen: stempelungenIn(db, betriebId, nutzerId, jetzt - RUECKBLICK, jetzt + 1),
          vormonat: () => vormonat(db, betriebId, nutzerId, jetzt),
        },
      ];
    });
