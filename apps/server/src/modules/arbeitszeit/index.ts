import { tagInBerlin } from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { arbeitszeitmodelle } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

/** A working-time model as the API shows it: the target minutes per weekday as a list */
export type Modell = Omit<typeof arbeitszeitmodelle.$inferSelect, "sollMinuten"> & {
  sollMinuten: number[];
};

export type NeuesModell = {
  name: string;
  /** Seven whole minutes, Monday to Sunday */
  sollMinuten: readonly number[];
  lohnArt: "monat" | "stunde";
  /** Cents per month or per hour; null while not yet known ("nicht hinterlegt") */
  lohnCent: number | null;
  minijob: boolean;
  /** The first day it holds; today in Europe/Berlin if not given */
  gueltigAb?: string | undefined;
};

const alsModell = (zeile: typeof arbeitszeitmodelle.$inferSelect): Modell => ({
  ...zeile,
  sollMinuten: JSON.parse(zeile.sollMinuten) as number[],
});

export const modelleLesen = (db: Db, betriebId: string): Modell[] =>
  db
    .select()
    .from(arbeitszeitmodelle)
    .where(eq(arbeitszeitmodelle.betriebId, betriebId))
    .orderBy(arbeitszeitmodelle.angelegtAm, arbeitszeitmodelle.name)
    .all()
    .map(alsModell);

export const modellAnlegen = (schreibDb: SchreibDb, kontext: Kontext, neu: NeuesModell): Modell =>
  alsModell(
    schreiben(schreibDb, kontext, (s) =>
      s.einfuegen("arbeitszeitmodelle", {
        betriebId: kontext.betriebId,
        modellId: crypto.randomUUID(),
        name: neu.name,
        sollMinuten: JSON.stringify(neu.sollMinuten),
        lohnArt: neu.lohnArt,
        lohnCent: neu.lohnCent,
        minijob: neu.minijob,
        gueltigAb: neu.gueltigAb ?? tagInBerlin(kontext.jetzt),
        angelegtAm: kontext.jetzt,
      }),
    ),
  );

/** Removes a model of the business; false if the business has no such model */
export const modellEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  modellId: string,
): boolean => {
  const vorhanden = db
    .select({ id: arbeitszeitmodelle.modellId })
    .from(arbeitszeitmodelle)
    .where(
      and(
        eq(arbeitszeitmodelle.betriebId, kontext.betriebId),
        eq(arbeitszeitmodelle.modellId, modellId),
      ),
    )
    .get();
  if (!vorhanden) return false;
  schreiben(schreibDb, kontext, (s) => s.loeschen("arbeitszeitmodelle", { modellId }));
  return true;
};
