import type { Land, Region } from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { standorte } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

/** A site as the API shows it: the regions as a list, not as the JSON text of the column */
export type Standort = Omit<typeof standorte.$inferSelect, "regionen" | "land"> & {
  land: Land;
  regionen: Region[];
};

const alsStandort = (zeile: typeof standorte.$inferSelect): Standort => ({
  ...zeile,
  land: zeile.land as Land,
  regionen: JSON.parse(zeile.regionen) as Region[],
});

/** The sites of a business in the order they were added */
export const standorteLesen = (db: Db, betriebId: string): Standort[] =>
  db
    .select()
    .from(standorte)
    .where(eq(standorte.betriebId, betriebId))
    .orderBy(standorte.angelegtAm, standorte.name)
    .all()
    .map(alsStandort);

export const standortAnlegen = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { name: string; adresse: string; land: Land; regionen: readonly Region[] },
): Standort =>
  alsStandort(
    schreiben(schreibDb, kontext, (s) =>
      s.einfuegen("standorte", {
        betriebId: kontext.betriebId,
        standortId: crypto.randomUUID(),
        name: angaben.name,
        adresse: angaben.adresse,
        land: angaben.land,
        regionen: JSON.stringify(angaben.regionen),
        angelegtAm: kontext.jetzt,
      }),
    ),
  );

/** Removes a site of the business; false if the business has no such site */
export const standortEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  standortId: string,
): boolean => {
  const vorhanden = db
    .select({ id: standorte.standortId })
    .from(standorte)
    .where(and(eq(standorte.betriebId, kontext.betriebId), eq(standorte.standortId, standortId)))
    .get();
  if (!vorhanden) return false;
  schreiben(schreibDb, kontext, (s) => s.loeschen("standorte", { standortId }));
  return true;
};
