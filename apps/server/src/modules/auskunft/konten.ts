import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { kontoAnpassungen, urlaubshinweise } from "../../db/schema.ts";
import { iso } from "./zeit.ts";

/*
 * The person's accounts (S-402): the changes by hand with their reason and the notices on leave
 * expiring with what they named; who entered them by name. The balances themselves are computed,
 * not stored (docs/plan.md, "Konten").
 */

export const kontenteil = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  name: (nutzerId: string) => string,
) => ({
  kontoAnpassungen: db
    .select()
    .from(kontoAnpassungen)
    .where(and(eq(kontoAnpassungen.betriebId, betriebId), eq(kontoAnpassungen.nutzerId, nutzerId)))
    .orderBy(kontoAnpassungen.erstelltAm)
    .all()
    .map(({ betriebId: _b, nutzerId: _n, ...z }) => ({
      ...z,
      erstelltVon: name(z.erstelltVon),
      erstelltAm: iso(z.erstelltAm),
    })),
  urlaubshinweise: db
    .select()
    .from(urlaubshinweise)
    .where(and(eq(urlaubshinweise.betriebId, betriebId), eq(urlaubshinweise.nutzerId, nutzerId)))
    .orderBy(urlaubshinweise.tag)
    .all()
    .map(({ betriebId: _b, nutzerId: _n, inhalt, ...z }) => ({
      ...z,
      inhalt: JSON.parse(inhalt) as unknown,
      erstelltVon: name(z.erstelltVon),
      erstelltAm: iso(z.erstelltAm),
    })),
});

export type Kontenteil = ReturnType<typeof kontenteil>;
