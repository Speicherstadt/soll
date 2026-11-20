import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { projekte, stundensaetze } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import {
  archivWert,
  type Ergebnis,
  type Extern,
  eindeutig,
  externWerte,
  gesetzt,
  nein,
  ok,
} from "./ergebnis.ts";
import { kundeLesen } from "./kunden.ts";

export type Projekt = typeof projekte.$inferSelect;

type Budgetfelder = {
  name?: string | undefined;
  nummer?: string | undefined;
  /** Whole minutes and whole cents, null for no budget */
  budgetMinuten?: number | null | undefined;
  budgetCent?: number | null | undefined;
  warnungProzent?: number | undefined;
};

export type NeuesProjekt = Extern & Budgetfelder & { kundeId: string; name: string };
export type ProjektAenderung = Budgetfelder & { archiviert?: boolean | undefined };

export const projekteLesen = (db: Db, betriebId: string): Projekt[] =>
  db
    .select()
    .from(projekte)
    .where(eq(projekte.betriebId, betriebId))
    .orderBy(projekte.name, projekte.angelegtAm)
    .all();

export const projektLesen = (db: Db, betriebId: string, projektId: string): Projekt | undefined =>
  db
    .select()
    .from(projekte)
    .where(and(eq(projekte.betriebId, betriebId), eq(projekte.projektId, projektId)))
    .get();

/** A new order of a known customer that is not archived */
export const projektAnlegen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  neu: NeuesProjekt,
): Ergebnis<Projekt> => {
  const kunde = kundeLesen(db, kontext.betriebId, neu.kundeId);
  if (!kunde) return nein("kunde_unbekannt");
  if (kunde.archiviertAm !== null) return nein("archiviert");
  return eindeutig(() =>
    schreiben(schreibDb, kontext, (s) =>
      s.einfuegen("projekte", {
        betriebId: kontext.betriebId,
        projektId: crypto.randomUUID(),
        kundeId: neu.kundeId,
        name: neu.name,
        nummer: neu.nummer ?? "",
        budgetMinuten: neu.budgetMinuten ?? null,
        budgetCent: neu.budgetCent ?? null,
        warnungProzent: neu.warnungProzent ?? 80,
        ...externWerte(neu),
        angelegtAm: kontext.jetzt,
      }),
    ),
  );
};

/**
 * Changes name, number, budget, threshold or the archive; the customer of an order stays, and an
 * order of an archived customer is restored only after its customer
 */
export const projektAendern = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  projektId: string,
  aenderung: ProjektAenderung,
): Ergebnis<Projekt> => {
  const projekt = projektLesen(db, kontext.betriebId, projektId);
  if (!projekt) return nein("unbekannt");
  const { archiviert, ...felder } = aenderung;
  // restoring an order would give an archived customer an active order again
  const kunde = kundeLesen(db, kontext.betriebId, projekt.kundeId);
  if (archiviert === false && (kunde?.archiviertAm ?? null) !== null) return nein("archiviert");
  return ok(
    schreiben(schreibDb, kontext, (s) =>
      s.aendern(
        "projekte",
        { projektId },
        { ...gesetzt(felder), ...archivWert(archiviert, kontext.jetzt) },
      ),
    ),
  );
};

/** Removes an order no rate names (from S-602 also: no booking); otherwise it is archived */
export const projektEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  projektId: string,
): Ergebnis<null> => {
  if (!projektLesen(db, kontext.betriebId, projektId)) return nein("unbekannt");
  const satz = db
    .select({ id: stundensaetze.satzId })
    .from(stundensaetze)
    .where(
      and(eq(stundensaetze.betriebId, kontext.betriebId), eq(stundensaetze.projektId, projektId)),
    )
    .get();
  if (satz) return nein("verwendet");
  schreiben(schreibDb, kontext, (s) => s.loeschen("projekte", { projektId }));
  return ok(null);
};
