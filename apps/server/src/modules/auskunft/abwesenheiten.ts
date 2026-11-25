import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { abwesenheiten } from "../../db/schema.ts";
import { iso } from "./zeit.ts";

/*
 * The person's absences (S-401): every request and sickness with its state, the reason of a refusal
 * or a cancellation, whether a certificate is there and the child's short id; who created and who
 * decided by name, as the stamps name who changed them. Soll keeps no diagnosis (Art. 9 DSGVO).
 */

export const abwesenheitsteil = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  name: (nutzerId: string) => string,
) => ({
  abwesenheiten: db
    .select()
    .from(abwesenheiten)
    .where(and(eq(abwesenheiten.betriebId, betriebId), eq(abwesenheiten.nutzerId, nutzerId)))
    .orderBy(abwesenheiten.von)
    .all()
    .map(({ betriebId: _b, nutzerId: _n, ...z }) => ({
      ...z,
      entschiedenVon: z.entschiedenVon === null ? null : name(z.entschiedenVon),
      entschiedenAm: z.entschiedenAm === null ? null : iso(z.entschiedenAm),
      erstelltVon: name(z.erstelltVon),
      erstelltAm: iso(z.erstelltAm),
    })),
});

export type Abwesenheitsteil = ReturnType<typeof abwesenheitsteil>;
