import { type Fragen, type Land, MODULE, type Modul, moduleAusFragen } from "@soll/arbeitszeit";
import { eq } from "drizzle-orm";
import { istBeschaeftigt } from "../../auth/rollen.ts";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { betriebe, mitgliedschaften } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

export { MODULE, type Modul };

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

/** The businesses that use a module, for the reminder loop (S-307) */
export const betriebeMitModul = (db: Db, modul: Modul): string[] =>
  db
    .select({ betriebId: betriebe.betriebId })
    .from(betriebe)
    .where(eq(betriebe[SPALTE[modul]], true))
    .all()
    .map(({ betriebId }) => betriebId);

/** How many people who work for the business are members (owner, external staff and devices not) */
export const beschaeftigte = (db: Db, betriebId: string): number =>
  db
    .select({ rolle: mitgliedschaften.rolle })
    .from(mitgliedschaften)
    .where(eq(mitgliedschaften.betriebId, betriebId))
    .all()
    .filter(({ rolle }) => istBeschaeftigt(rolle)).length;

/**
 * Switches working time back on once the business has employees, whichever way they came (an
 * invitation, a change of role): the duty to record holds for them (BAG 1 ABR 22/21, § 3 Abs. 2
 * Nr. 1 ArbSchG). Called after every change of membership; the owner is told why (S-603).
 */
export const arbeitszeitPflichtWahren = (db: Db, schreibDb: SchreibDb, kontext: Kontext): void => {
  if (modulAktiv(db, kontext.betriebId, "arbeitszeit")) return;
  if (!betriebLesen(db, kontext.betriebId) || beschaeftigte(db, kontext.betriebId) === 0) return;
  schreiben(schreibDb, kontext, (s) =>
    s.aendern(
      "betriebe",
      { betriebId: kontext.betriebId },
      { modulArbeitszeit: true, pflichtHinweisAm: kontext.jetzt },
    ),
  );
};

/** What Soll tells the owner about a change it made itself: working time switched on (S-603) */
export type Hinweis = { art: "arbeitszeit_eingeschaltet"; am: number };

export const hinweisVon = (betrieb: Betrieb): Hinweis | null =>
  betrieb.pflichtHinweisAm === null
    ? null
    : { art: "arbeitszeit_eingeschaltet", am: betrieb.pflichtHinweisAm };

/** The owner has read the notice; confirming it again changes nothing */
export const hinweisBestaetigen = (db: Db, schreibDb: SchreibDb, kontext: Kontext): void => {
  if (betriebLesen(db, kontext.betriebId)?.pflichtHinweisAm == null) return;
  schreiben(schreibDb, kontext, (s) =>
    s.aendern("betriebe", { betriebId: kontext.betriebId }, { pflichtHinweisAm: null }),
  );
};

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

export type EinrichtenErgebnis =
  | { ok: true; betrieb: Betrieb }
  | { ok: false; grund: "arbeitszeit_pflicht" | "kein_betrieb" };

/**
 * The first step of the setup: name, Land and the modules the four questions switch (S-303), in one
 * write. "No employees" cannot switch working time off while the business has employees.
 */
export const betriebEinrichten = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { name: string; land: Land; fragen: Fragen },
): EinrichtenErgebnis => {
  if (!betriebLesen(db, kontext.betriebId)) return { ok: false, grund: "kein_betrieb" };
  const module = moduleAusFragen(angaben.fragen);
  if (!module.arbeitszeit && beschaeftigte(db, kontext.betriebId) > 0)
    return { ok: false, grund: "arbeitszeit_pflicht" };
  const spalten = Object.fromEntries(MODULE.map((modul) => [SPALTE[modul], module[modul]]));
  const betrieb = schreiben(schreibDb, kontext, (s) =>
    s.aendern(
      "betriebe",
      { betriebId: kontext.betriebId },
      { name: angaben.name, land: angaben.land, ...spalten },
    ),
  );
  return { ok: true, betrieb };
};

/** Marks the setup as done, once: the first time stays */
export const einrichtungAbschliessen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
): boolean => {
  const betrieb = betriebLesen(db, kontext.betriebId);
  if (!betrieb) return false;
  if (betrieb.eingerichtetAm !== null) return true;
  schreiben(schreibDb, kontext, (s) =>
    s.aendern("betriebe", { betriebId: kontext.betriebId }, { eingerichtetAm: kontext.jetzt }),
  );
  return true;
};
