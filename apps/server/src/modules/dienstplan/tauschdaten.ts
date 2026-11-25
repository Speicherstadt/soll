import { and, eq, gt, inArray } from "drizzle-orm";
import { darf } from "../../auth/rollen.ts";
import type { Db } from "../../db/oeffnen.ts";
import { schichten, schichttausche, tauschregeln } from "../../db/schema.ts";
import type { Schreiber } from "../audit/index.ts";
import { mitgliederMitNamen, mitgliedschaftVon } from "../mitglieder/index.ts";
import type { Schicht } from "./schichten.ts";
import type { Tausch } from "./tausch.ts";

/* What the swap (S-504) reads of the database, and how a change to a shift ends its offers */

export const tauschLesen = (db: Db, betriebId: string, tauschId: string): Tausch | undefined =>
  db
    .select()
    .from(schichttausche)
    .where(and(eq(schichttausche.betriebId, betriebId), eq(schichttausche.tauschId, tauschId)))
    .get();

/** The swaps of a shift that nobody decided yet: at most one (tauschen.ts) */
export const offeneTauscheDer = (db: Db, betriebId: string, schichtId: string): Tausch[] =>
  db
    .select()
    .from(schichttausche)
    .where(
      and(
        eq(schichttausche.betriebId, betriebId),
        eq(schichttausche.schichtId, schichtId),
        inArray(schichttausche.status, ["offen", "uebernommen"]),
      ),
    )
    .all();

/** The swaps of the shifts that have not begun yet, each with its shift */
export const kommendeTausche = (
  db: Db,
  betriebId: string,
  jetzt: number,
): { tausch: Tausch; schicht: Schicht }[] =>
  db
    .select({ tausch: schichttausche, schicht: schichten })
    .from(schichttausche)
    .innerJoin(
      schichten,
      and(
        eq(schichten.betriebId, schichttausche.betriebId),
        eq(schichten.schichtId, schichttausche.schichtId),
      ),
    )
    .where(and(eq(schichttausche.betriebId, betriebId), gt(schichten.beginn, jetzt)))
    .orderBy(schichten.beginn, schichttausche.angebotenAm)
    .all();

/**
 * Whether a person can take over a shift: a member who works in shifts (`stempeln`) and reads the
 * plan, as the rows of the plan are made (woche.ts)
 */
export const kannUebernehmen = (db: Db, betriebId: string, nutzerId: string): boolean => {
  const mitglied = mitgliedschaftVon(db, betriebId, nutzerId);
  return (
    mitglied !== undefined && darf(mitglied.rolle, "stempeln") && darf(mitglied.rolle, "plan:lesen")
  );
};

/** The colleagues who can take over a shift, by name; names only (docs/plan.md, "Schichttausch") */
export const uebernehmende = (db: Db, betriebId: string) =>
  mitgliederMitNamen(db, betriebId)
    .filter(({ rolle }) => darf(rolle, "stempeln") && darf(rolle, "plan:lesen"))
    .map(({ nutzerId, name }) => ({ nutzerId, name }));

/** Who approves a swap: owner and planner */
export const freigebende = (db: Db, betriebId: string): string[] =>
  mitgliederMitNamen(db, betriebId)
    .filter(({ rolle }) => darf(rolle, "plan:planen"))
    .map(({ nutzerId }) => nutzerId);

/** A person's shifts, published only or with the drafts, for a takeover that would overlap */
export const schichtenDer = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  auchEntwuerfe: boolean,
): Schicht[] =>
  db
    .select()
    .from(schichten)
    .where(and(eq(schichten.betriebId, betriebId), eq(schichten.nutzerId, nutzerId)))
    .all()
    .filter((schicht) => auchEntwuerfe || schicht.veroeffentlichtAm !== null);

/** Whether a swap needs approval: without a setting it does */
export const ohneFreigabe = (db: Db, betriebId: string): boolean =>
  db.select().from(tauschregeln).where(eq(tauschregeln.betriebId, betriebId)).get()?.ohneFreigabe ??
  false;

/**
 * A change to a shift or its removal by whoever plans ends its open offers (`hinfaellig`), in the
 * same transaction: whoever took it agreed to the shift as it was (S-504)
 */
export const offeneBeenden = (
  s: Schreiber,
  offene: readonly Tausch[],
  kontext: { akteur: string; jetzt: number },
): void => {
  for (const { tauschId } of offene)
    s.aendern(
      "schichttausche",
      { tauschId },
      { status: "hinfaellig", entschiedenVon: kontext.akteur, entschiedenAm: kontext.jetzt },
    );
};
