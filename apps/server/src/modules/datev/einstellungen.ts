import type { DatevEinstellungen, Lohnarten } from "@soll/export";
import { eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { datevEinstellungen, datevPersonalnummern } from "../../db/schema.ts";
import { type Kontext, type Schreiber, schreiben } from "../audit/index.ts";
import { mitgliedschaftVon } from "../mitglieder/index.ts";

/*
 * The mapping of a business for the DATEV payroll export (S-308): consultant and client number,
 * the wage type of each item and the personnel number of each person. Without a row everything is
 * "nicht hinterlegt"; every write goes through the audit chain.
 */

export const einstellungenLesen = (db: Db, betriebId: string): DatevEinstellungen => {
  const zeile = db
    .select()
    .from(datevEinstellungen)
    .where(eq(datevEinstellungen.betriebId, betriebId))
    .get();
  const personalnummern = Object.fromEntries(
    db
      .select()
      .from(datevPersonalnummern)
      .where(eq(datevPersonalnummern.betriebId, betriebId))
      .all()
      .map((p) => [p.nutzerId, p.personalnummer]),
  );
  return {
    beraterNr: zeile?.beraterNr ?? null,
    mandantenNr: zeile?.mandantenNr ?? null,
    lohnarten: zeile ? (JSON.parse(zeile.lohnarten) as Lohnarten) : {},
    personalnummern,
  };
};

/** What the owner or the payroll office sets; a personnel number null removes it */
export type NeueEinstellungen = {
  beraterNr: string | null;
  mandantenNr: string | null;
  lohnarten: Lohnarten;
  personalnummern: Readonly<Record<string, string | null>>;
};

export type SetzenErgebnis =
  | { ok: true; wert: DatevEinstellungen }
  | { ok: false; grund: "unbekannt" | "doppelt" };

/** The personnel numbers as they would stand after the change */
const nachher = (
  vorher: Readonly<Record<string, string>>,
  neu: NeueEinstellungen["personalnummern"],
) => {
  const ergebnis = new Map(Object.entries(vorher));
  for (const [nutzerId, nummer] of Object.entries(neu)) {
    if (nummer === null) ergebnis.delete(nutzerId);
    else ergebnis.set(nutzerId, nummer);
  }
  return ergebnis;
};

/**
 * The changed numbers: rows that change or go are removed first, then the new ones added, so two
 * people can swap their numbers in one write without meeting the unique index halfway
 */
const nummernSchreiben = (
  s: Schreiber,
  betriebId: string,
  vorher: Readonly<Record<string, string>>,
  danach: ReadonlyMap<string, string>,
) => {
  const geaendert = (nutzerId: string) => vorher[nutzerId] !== danach.get(nutzerId);
  for (const nutzerId of Object.keys(vorher).filter(geaendert))
    s.loeschen("datevPersonalnummern", { nutzerId });
  for (const [nutzerId, personalnummer] of danach)
    if (geaendert(nutzerId))
      s.einfuegen("datevPersonalnummern", { betriebId, nutzerId, personalnummer });
};

/**
 * Sets the mapping of the business. A personnel number goes only to a member of the business and
 * only once: two people with one number would be paid as one.
 */
export const einstellungenSetzen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  neu: NeueEinstellungen,
): SetzenErgebnis => {
  const { betriebId } = kontext;
  const vorher = einstellungenLesen(db, betriebId);
  for (const nutzerId of Object.keys(neu.personalnummern))
    if (!mitgliedschaftVon(db, betriebId, nutzerId)) return { ok: false, grund: "unbekannt" };
  const danach = nachher(vorher.personalnummern, neu.personalnummern);
  if (new Set(danach.values()).size !== danach.size) return { ok: false, grund: "doppelt" };
  const werte = {
    beraterNr: neu.beraterNr,
    mandantenNr: neu.mandantenNr,
    lohnarten: JSON.stringify(neu.lohnarten),
    geaendertAm: kontext.jetzt,
  };
  const vorhanden = db
    .select({ id: datevEinstellungen.betriebId })
    .from(datevEinstellungen)
    .where(eq(datevEinstellungen.betriebId, betriebId))
    .get();
  schreiben(schreibDb, kontext, (s) => {
    if (vorhanden) s.aendern("datevEinstellungen", { betriebId }, werte);
    else s.einfuegen("datevEinstellungen", { betriebId, ...werte });
    nummernSchreiben(s, betriebId, vorher.personalnummern, danach);
  });
  return { ok: true, wert: einstellungenLesen(db, betriebId) };
};
