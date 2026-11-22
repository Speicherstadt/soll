import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { personenangaben } from "../../db/schema.ts";
import { iso } from "./zeit.ts";

/*
 * What the rules need of the person (S-502): birth date, Wechselschicht, work on call and the spans
 * of the Mutterschutz, as the owner entered them; null while nothing is entered.
 */

export const personenangabenteil = (db: Db, betriebId: string, nutzerId: string) => {
  const zeile = db
    .select()
    .from(personenangaben)
    .where(and(eq(personenangaben.betriebId, betriebId), eq(personenangaben.nutzerId, nutzerId)))
    .get();
  return {
    personenangaben: zeile
      ? {
          geburtsdatum: zeile.geburtsdatum,
          wechselschicht: zeile.wechselschicht,
          abruf: zeile.abruf,
          mutterschutz: JSON.parse(zeile.mutterschutz) as { von: string; bis: string | null }[],
          geaendertAm: iso(zeile.geaendertAm),
        }
      : null,
  };
};

export type Personenangabenteil = ReturnType<typeof personenangabenteil>;
