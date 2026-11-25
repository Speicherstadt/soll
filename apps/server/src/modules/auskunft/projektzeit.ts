import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { projektzeiten, stundensaetze } from "../../db/schema.ts";
import { iso } from "./zeit.ts";

/*
 * The hourly rates set for the person (S-601): a rate with the person's id is data about them; the
 * business's rates for everyone and other people's are not part of the copy (Art. 15 Abs. 4 DSGVO).
 * The person's bookings of project time (S-602), each with the rate it was billed with.
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
  projektzeiten: db
    .select()
    .from(projektzeiten)
    .where(and(eq(projektzeiten.betriebId, betriebId), eq(projektzeiten.nutzerId, nutzerId)))
    .orderBy(projektzeiten.beginn)
    .all()
    .map(({ betriebId: _b, importId, externQuelle, externId, ...z }) => ({
      ...z,
      beginn: iso(z.beginn),
      ende: z.ende === null ? null : iso(z.ende),
      abgerechnetAm: z.abgerechnetAm === null ? null : iso(z.abgerechnetAm),
      angelegtAm: iso(z.angelegtAm),
      // made from a spreadsheet's time (S-702): the import, the tool and the id there, as for stamps
      ...(externQuelle === null
        ? {}
        : { uebernommen: { importId, quelle: externQuelle, kennung: externId } }),
    })),
});

export type Projektteil = ReturnType<typeof projektteil>;
