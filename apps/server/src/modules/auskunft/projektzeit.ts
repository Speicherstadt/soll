import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { stundensaetze } from "../../db/schema.ts";
import { iso } from "./zeit.ts";

/*
 * The hourly rates set for the person (S-601): a rate with the person's id is data about them; the
 * business's rates for everyone and other people's are not part of the copy (Art. 15 Abs. 4 DSGVO).
 */

export const projektteil = (db: Db, betriebId: string, nutzerId: string) => ({
  stundensaetze: db
    .select()
    .from(stundensaetze)
    .where(and(eq(stundensaetze.betriebId, betriebId), eq(stundensaetze.nutzerId, nutzerId)))
    .orderBy(stundensaetze.gueltigAb)
    .all()
    .map((z) => ({
      satzId: z.satzId,
      kundeId: z.kundeId,
      projektId: z.projektId,
      taetigkeitId: z.taetigkeitId,
      gueltigAb: z.gueltigAb,
      centProStunde: z.centProStunde,
      angelegtAm: iso(z.angelegtAm),
    })),
});

export type Projektteil = ReturnType<typeof projektteil>;
