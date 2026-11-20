import type { Bedarf } from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { bedarfe } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

export type BedarfAngaben = Omit<Bedarf, "bedarfId">;

const alsBedarf = ({ betriebId: _, angelegtAm: __, ...bedarf }: typeof bedarfe.$inferSelect) =>
  bedarf satisfies Bedarf;

/** The needs of a site, by weekday and time */
export const bedarfeLesen = (db: Db, betriebId: string, standortId: string): Bedarf[] =>
  db
    .select()
    .from(bedarfe)
    .where(and(eq(bedarfe.betriebId, betriebId), eq(bedarfe.standortId, standortId)))
    .orderBy(bedarfe.wochentag, bedarfe.beginnMinute, bedarfe.rolle)
    .all()
    .map(alsBedarf);

export const bedarfAnlegen = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: BedarfAngaben,
): Bedarf =>
  alsBedarf(
    schreiben(schreibDb, kontext, (s) =>
      s.einfuegen("bedarfe", {
        betriebId: kontext.betriebId,
        bedarfId: crypto.randomUUID(),
        ...angaben,
        angelegtAm: kontext.jetzt,
      }),
    ),
  );

export const bedarfEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  bedarfId: string,
): boolean => {
  const vorhanden = db
    .select({ id: bedarfe.bedarfId })
    .from(bedarfe)
    .where(and(eq(bedarfe.betriebId, kontext.betriebId), eq(bedarfe.bedarfId, bedarfId)))
    .get();
  if (!vorhanden) return false;
  schreiben(schreibDb, kontext, (s) => s.loeschen("bedarfe", { bedarfId }));
  return true;
};
