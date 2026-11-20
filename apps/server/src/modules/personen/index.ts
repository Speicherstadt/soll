import type { PlanPerson, Tag } from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { personenangaben } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

/*
 * What the rules need of a person (S-502): only these fields, kept by the owner, written into the
 * audit chain (docs/plan.md, "Daten zur Person").
 */

export type Spanne = { von: Tag; bis: Tag | null };

export type Angaben = {
  geburtsdatum: Tag | null;
  wechselschicht: boolean;
  abruf: boolean;
  mutterschutz: Spanne[];
};

/** A person nothing is entered for: no birth date, no mark, no span */
const LEER: Angaben = { geburtsdatum: null, wechselschicht: false, abruf: false, mutterschutz: [] };

const dieser = (betriebId: string, nutzerId: string) =>
  and(eq(personenangaben.betriebId, betriebId), eq(personenangaben.nutzerId, nutzerId));

const alsAngaben = (zeile: typeof personenangaben.$inferSelect): Angaben => ({
  geburtsdatum: zeile.geburtsdatum,
  wechselschicht: zeile.wechselschicht,
  abruf: zeile.abruf,
  mutterschutz: JSON.parse(zeile.mutterschutz) as Spanne[],
});

export const angabenLesen = (db: Db, betriebId: string, nutzerId: string): Angaben => {
  const zeile = db.select().from(personenangaben).where(dieser(betriebId, nutzerId)).get();
  return zeile ? alsAngaben(zeile) : LEER;
};

export const angabenSetzen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
  angaben: Angaben,
): Angaben => {
  const werte = {
    geburtsdatum: angaben.geburtsdatum,
    wechselschicht: angaben.wechselschicht,
    abruf: angaben.abruf,
    mutterschutz: JSON.stringify(angaben.mutterschutz),
    geaendertAm: kontext.jetzt,
  };
  const vorhanden = db
    .select()
    .from(personenangaben)
    .where(dieser(kontext.betriebId, nutzerId))
    .get();
  const zeile = schreiben(schreibDb, kontext, (s) =>
    vorhanden
      ? s.aendern("personenangaben", { nutzerId }, werte)
      : s.einfuegen("personenangaben", { betriebId: kontext.betriebId, nutzerId, ...werte }),
  );
  return alsAngaben(zeile);
};

/** The data in the form of the check of the plan (packages/arbeitszeit, `planBefunde`) */
export const planPersonAus = (angaben: Angaben): PlanPerson => ({
  geburtsdatum: angaben.geburtsdatum,
  wechselschicht: angaben.wechselschicht,
  abruf: angaben.abruf,
  mutterschutz: angaben.mutterschutz,
});
