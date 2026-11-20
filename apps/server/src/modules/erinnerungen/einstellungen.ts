import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { erinnerungseinstellungen, erinnerungsregeln } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { ALLE_WUENSCHE, REGELN_VORGABE, type Regeln, type Wuensche } from "./faellig.ts";

/** What a person wants; without a row every reminder, with mail as a fallback */
export const wuenscheVon = (db: Db, betriebId: string, nutzerId: string): Wuensche => {
  const zeile = db
    .select()
    .from(erinnerungseinstellungen)
    .where(
      and(
        eq(erinnerungseinstellungen.betriebId, betriebId),
        eq(erinnerungseinstellungen.nutzerId, nutzerId),
      ),
    )
    .get();
  return zeile
    ? { ausstempeln: zeile.ausstempeln, pause: zeile.pause, monat: zeile.monat, mail: zeile.mail }
    : ALLE_WUENSCHE;
};

/** Sets the wishes of the person who writes (`kontext.akteur`) */
export const wuenscheSetzen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  wuensche: Wuensche,
): Wuensche => {
  const schluessel = { betriebId: kontext.betriebId, nutzerId: kontext.akteur };
  const vorhanden = db
    .select({ id: erinnerungseinstellungen.nutzerId })
    .from(erinnerungseinstellungen)
    .where(
      and(
        eq(erinnerungseinstellungen.betriebId, kontext.betriebId),
        eq(erinnerungseinstellungen.nutzerId, kontext.akteur),
      ),
    )
    .get();
  schreiben(schreibDb, kontext, (s) =>
    vorhanden
      ? s.aendern("erinnerungseinstellungen", schluessel, wuensche)
      : s.einfuegen("erinnerungseinstellungen", { ...schluessel, ...wuensche }),
  );
  return wuensche;
};

const regelZeile = (db: Db, betriebId: string) =>
  db.select().from(erinnerungsregeln).where(eq(erinnerungsregeln.betriebId, betriebId)).get();

/** The times of the business; without a row the defaults */
export const regelnVon = (db: Db, betriebId: string): Regeln => {
  const zeile = regelZeile(db, betriebId);
  return zeile
    ? {
        gehenMinuten: zeile.gehenMinuten,
        pauseVorlauf: zeile.pauseVorlauf,
        monatTag: zeile.monatTag,
      }
    : REGELN_VORGABE;
};

export const regelnSetzen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  regeln: Regeln,
): Regeln => {
  const vorhanden = regelZeile(db, kontext.betriebId);
  schreiben(schreibDb, kontext, (s) =>
    vorhanden
      ? s.aendern("erinnerungsregeln", { betriebId: kontext.betriebId }, regeln)
      : s.einfuegen("erinnerungsregeln", { betriebId: kontext.betriebId, ...regeln }),
  );
  return regeln;
};
