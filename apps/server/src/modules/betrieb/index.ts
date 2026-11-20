import { and, count, eq, inArray } from "drizzle-orm";
import { BESCHAEFTIGT } from "../../auth/rollen.ts";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { betriebe, mitgliedschaften } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

export const MODULE = ["arbeitszeit", "dienstplan", "projektzeit", "terminal"] as const;
export type Modul = (typeof MODULE)[number];

const SPALTE = {
  arbeitszeit: "modulArbeitszeit",
  dienstplan: "modulDienstplan",
  projektzeit: "modulProjektzeit",
  terminal: "modulTerminal",
} as const satisfies Record<Modul, keyof typeof betriebe.$inferSelect>;

export type Betrieb = typeof betriebe.$inferSelect;

/** The business row for a new organization, with working time switched on (docs/plan.md) */
export const betriebAnlegen = (schreibDb: SchreibDb, kontext: Kontext, name: string): Betrieb =>
  schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("betriebe", { betriebId: kontext.betriebId, name, angelegtAm: kontext.jetzt }),
  );

export const betriebLesen = (db: Db, betriebId: string): Betrieb | undefined =>
  db.select().from(betriebe).where(eq(betriebe.betriebId, betriebId)).get();

export const moduleVon = (betrieb: Betrieb): Record<Modul, boolean> =>
  Object.fromEntries(MODULE.map((modul) => [modul, betrieb[SPALTE[modul]]])) as Record<
    Modul,
    boolean
  >;

export const modulAktiv = (db: Db, betriebId: string, modul: Modul): boolean => {
  const betrieb = betriebLesen(db, betriebId);
  return betrieb ? betrieb[SPALTE[modul]] : false;
};

/** How many people who work for the business are members (owner, external staff and devices not) */
export const beschaeftigte = (db: Db, betriebId: string): number =>
  db
    .select({ anzahl: count() })
    .from(mitgliedschaften)
    .where(
      and(
        eq(mitgliedschaften.betriebId, betriebId),
        inArray(mitgliedschaften.rolle, [...BESCHAEFTIGT]),
      ),
    )
    .get()?.anzahl ?? 0;

export type ModulErgebnis =
  | { ok: true; module: Record<Modul, boolean> }
  | { ok: false; grund: "arbeitszeit_pflicht" | "kein_betrieb" };

/**
 * Switches modules. Working time stays on while the business has employees (duty to record, BAG
 * 1 ABR 22/21); switching a module off deletes none of its data.
 */
export const moduleSetzen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  aenderung: { [M in Modul]?: boolean | undefined },
): ModulErgebnis => {
  if (!betriebLesen(db, kontext.betriebId)) return { ok: false, grund: "kein_betrieb" };
  if (aenderung.arbeitszeit === false && beschaeftigte(db, kontext.betriebId) > 0) {
    return { ok: false, grund: "arbeitszeit_pflicht" };
  }
  const werte = Object.fromEntries(
    MODULE.filter((modul) => aenderung[modul] !== undefined).map((modul) => [
      SPALTE[modul],
      aenderung[modul],
    ]),
  );
  if (Object.keys(werte).length === 0) {
    return { ok: true, module: moduleVon(betriebLesen(db, kontext.betriebId) as Betrieb) };
  }
  const neu = schreiben(schreibDb, kontext, (s) =>
    s.aendern("betriebe", { betriebId: kontext.betriebId }, werte),
  );
  return { ok: true, module: moduleVon(neu) };
};
