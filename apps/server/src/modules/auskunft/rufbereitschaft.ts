import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { einsaetze, rufdienste } from "../../db/schema.ts";
import { iso } from "./zeit.ts";

/*
 * The person's Rufbereitschaft in the plan, drafts included, and the call-outs from it with every
 * reason (S-505): data about the person, as the shifts are
 */

export const rufbereitschaftsteil = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  name: (nutzerId: string) => string,
) => ({
  rufdienste: db
    .select()
    .from(rufdienste)
    .where(and(eq(rufdienste.betriebId, betriebId), eq(rufdienste.nutzerId, nutzerId)))
    .orderBy(rufdienste.beginn)
    .all()
    .map((z) => ({
      rufdienstId: z.rufdienstId,
      tag: z.tag,
      beginn: iso(z.beginn),
      ende: iso(z.ende),
      reaktionMinuten: z.reaktionMinuten,
      veroeffentlichtAm: z.veroeffentlichtAm === null ? null : iso(z.veroeffentlichtAm),
    })),
  einsaetze: db
    .select()
    .from(einsaetze)
    .where(and(eq(einsaetze.betriebId, betriebId), eq(einsaetze.nutzerId, nutzerId)))
    .orderBy(einsaetze.beginn)
    .all()
    .map((z) => ({
      einsatzId: z.einsatzId,
      rufdienstId: z.rufdienstId,
      beginn: iso(z.beginn),
      ende: z.ende === null ? null : iso(z.ende),
      grund: z.grund,
      entfernt: z.entfernt,
      entferntGrund: z.entferntGrund,
      erstelltVon: name(z.erstelltVon),
      erstelltAm: iso(z.erstelltAm),
    })),
});

export type Rufbereitschaftsteil = ReturnType<typeof rufbereitschaftsteil>;
