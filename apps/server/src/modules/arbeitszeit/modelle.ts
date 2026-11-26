import { tagInBerlin, type Zuschlagssaetze } from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { arbeitszeitmodelle, modellzuordnungen } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

/** A working-time model as the API shows it: the target minutes and the surcharges as values */
export type Modell = Omit<
  typeof arbeitszeitmodelle.$inferSelect,
  "sollMinuten" | "zuschlagssaetze"
> & {
  sollMinuten: number[];
  zuschlagssaetze: Zuschlagssaetze;
};

export type NeuesModell = {
  name: string;
  /** Seven whole minutes, Monday to Sunday */
  sollMinuten: readonly number[];
  lohnArt: "monat" | "stunde";
  /** Cents per month or per hour; null while not yet known ("nicht hinterlegt") */
  lohnCent: number | null;
  minijob: boolean;
  /** Automatic deduction of missing statutory Ruhepausen on closed shifts (R-04); default false */
  pausenabzug?: boolean | undefined;
  /** The surcharges it pays in basis points (S-207); a rate not set is not paid */
  zuschlagssaetze?: Zuschlagssaetze | undefined;
  /** The first day it holds; today in Europe/Berlin if not given */
  gueltigAb?: string | undefined;
};

const alsModell = (zeile: typeof arbeitszeitmodelle.$inferSelect): Modell => ({
  ...zeile,
  sollMinuten: JSON.parse(zeile.sollMinuten) as number[],
  zuschlagssaetze: JSON.parse(zeile.zuschlagssaetze) as Zuschlagssaetze,
});

export const modelleLesen = (db: Db, betriebId: string): Modell[] =>
  db
    .select()
    .from(arbeitszeitmodelle)
    .where(eq(arbeitszeitmodelle.betriebId, betriebId))
    .orderBy(arbeitszeitmodelle.angelegtAm, arbeitszeitmodelle.name)
    .all()
    .map(alsModell);

export const modellLesen = (db: Db, betriebId: string, modellId: string): Modell | undefined => {
  const zeile = db
    .select()
    .from(arbeitszeitmodelle)
    .where(
      and(eq(arbeitszeitmodelle.betriebId, betriebId), eq(arbeitszeitmodelle.modellId, modellId)),
    )
    .get();
  return zeile ? alsModell(zeile) : undefined;
};

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
        pausenabzug: neu.pausenabzug ?? false,
        zuschlagssaetze: JSON.stringify(neu.zuschlagssaetze ?? {}),
        gueltigAb: neu.gueltigAb ?? tagInBerlin(kontext.jetzt),
        angelegtAm: kontext.jetzt,
      }),
    ),
  );

export type EntfernenErgebnis = { ok: true } | { ok: false; grund: "unbekannt" | "zugeordnet" };

/**
 * Removes a model of the business; one assigned to a person stays, since the target of their days
 * comes from it (S-304)
 */
export const modellEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  modellId: string,
): EntfernenErgebnis => {
  if (!modellLesen(db, kontext.betriebId, modellId)) return { ok: false, grund: "unbekannt" };
  const zugeordnet = db
    .select({ nutzerId: modellzuordnungen.nutzerId })
    .from(modellzuordnungen)
    .where(
      and(
        eq(modellzuordnungen.betriebId, kontext.betriebId),
        eq(modellzuordnungen.modellId, modellId),
      ),
    )
    .get();
  if (zugeordnet) return { ok: false, grund: "zugeordnet" };
  schreiben(schreibDb, kontext, (s) => s.loeschen("arbeitszeitmodelle", { modellId }));
  return { ok: true };
};
