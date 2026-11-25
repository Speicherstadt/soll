import type { Abschluss, HinweisPosten, KontoAnpassung, Monat, Tag } from "@soll/arbeitszeit";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../../db/oeffnen.ts";
import { kontoAnpassungen, monatsabschluesse, urlaubshinweise } from "../../../db/schema.ts";
import { ausgesonderteMonate } from "../abschluss.ts";
import type { Monatsinhalt } from "../monatsinhalt.ts";

/*
 * What the accounts of a person are computed from (S-402): the closed months, the changes by hand
 * and the notices on leave expiring. Nothing of the balances is stored (docs/plan.md, "Konten").
 */

export type AnpassungZeile = typeof kontoAnpassungen.$inferSelect;
export type HinweisZeile = Omit<typeof urlaubshinweise.$inferSelect, "inhalt"> & {
  inhalt: HinweisPosten[];
};

export const anpassungenVon = (db: Db, betriebId: string, nutzerId: string): AnpassungZeile[] =>
  db
    .select()
    .from(kontoAnpassungen)
    .where(and(eq(kontoAnpassungen.betriebId, betriebId), eq(kontoAnpassungen.nutzerId, nutzerId)))
    .orderBy(asc(kontoAnpassungen.erstelltAm))
    .all();

export const hinweiseVon = (db: Db, betriebId: string, nutzerId: string): HinweisZeile[] =>
  db
    .select()
    .from(urlaubshinweise)
    .where(and(eq(urlaubshinweise.betriebId, betriebId), eq(urlaubshinweise.nutzerId, nutzerId)))
    .orderBy(asc(urlaubshinweise.tag))
    .all()
    .map((zeile) => ({ ...zeile, inhalt: JSON.parse(zeile.inhalt) as HinweisPosten[] }));

/** The changes of the overtime account in the form `ueberstundenkonto` takes */
export const stundenAnpassungen = (zeilen: readonly AnpassungZeile[]): KontoAnpassung[] =>
  zeilen.flatMap((z) =>
    (z.art === "startsaldo" || z.art === "auszahlung" || z.art === "korrektur") &&
    z.monat !== null &&
    z.minuten !== null
      ? [{ monat: z.monat as Monat, art: z.art, minuten: z.minuten }]
      : [],
  );

/** The closed months with their sums; a month closed without them is "nicht hinterlegt" */
export const abschluesseVon = (
  db: Db,
  betriebId: string,
  nutzerId: string,
): { abschluesse: Abschluss[]; ohneSummen: Monat[] } => {
  const zeilen = db
    .select({ monat: monatsabschluesse.monat, inhalt: monatsabschluesse.inhalt })
    .from(monatsabschluesse)
    .where(
      and(
        eq(monatsabschluesse.betriebId, betriebId),
        eq(monatsabschluesse.nutzerId, nutzerId),
        eq(monatsabschluesse.schritt, "abgeschlossen"),
      ),
    )
    .orderBy(asc(monatsabschluesse.monat))
    .all();
  const abschluesse: Abschluss[] = [];
  const ohneSummen: Monat[] = [];
  for (const { monat, inhalt } of zeilen) {
    const { summen } = JSON.parse(inhalt) as Monatsinhalt;
    if (summen === null) ohneSummen.push(monat as Monat);
    else
      abschluesse.push({ monat, sollMinuten: summen.sollMinuten, istMinuten: summen.istMinuten });
  }
  return { abschluesse, ohneSummen };
};

/** The months of the person removed after their retention period, from `ab` on */
export const ausgesondertAb = (db: Db, betriebId: string, nutzerId: string, ab: Tag): Monat[] =>
  [...ausgesonderteMonate(db, betriebId, nutzerId)]
    .filter((monat) => monat >= ab.slice(0, 7))
    .sort();
