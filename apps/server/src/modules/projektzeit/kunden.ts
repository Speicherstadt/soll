import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { kunden, projekte, stundensaetze } from "../../db/schema.ts";
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

export type Kunde = typeof kunden.$inferSelect;

export type NeuerKunde = Extern & { name: string; nummer?: string | undefined };
export type KundeAenderung = {
  name?: string | undefined;
  nummer?: string | undefined;
  archiviert?: boolean | undefined;
};

export const kundenLesen = (db: Db, betriebId: string): Kunde[] =>
  db
    .select()
    .from(kunden)
    .where(eq(kunden.betriebId, betriebId))
    .orderBy(kunden.name, kunden.angelegtAm)
    .all();

export const kundeLesen = (db: Db, betriebId: string, kundeId: string): Kunde | undefined =>
  db
    .select()
    .from(kunden)
    .where(and(eq(kunden.betriebId, betriebId), eq(kunden.kundeId, kundeId)))
    .get();

export const kundeAnlegen = (schreibDb: SchreibDb, kontext: Kontext, neu: NeuerKunde) =>
  eindeutig(() =>
    schreiben(schreibDb, kontext, (s) =>
      s.einfuegen("kunden", {
        betriebId: kontext.betriebId,
        kundeId: crypto.randomUUID(),
        name: neu.name,
        nummer: neu.nummer ?? "",
        ...externWerte(neu),
        angelegtAm: kontext.jetzt,
      }),
    ),
  );

export const kundeAendern = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  kundeId: string,
  aenderung: KundeAenderung,
): Ergebnis<Kunde> => {
  if (!kundeLesen(db, kontext.betriebId, kundeId)) return nein("unbekannt");
  const { archiviert, ...felder } = aenderung;
  return ok(
    schreiben(schreibDb, kontext, (s) =>
      s.aendern(
        "kunden",
        { kundeId },
        { ...gesetzt(felder), ...archivWert(archiviert, kontext.jetzt) },
      ),
    ),
  );
};

/** Whether an order or a rate still names the customer: then it is archived, not removed */
const kundeVerwendet = (db: Db, betriebId: string, kundeId: string): boolean =>
  Boolean(
    db
      .select({ id: projekte.projektId })
      .from(projekte)
      .where(and(eq(projekte.betriebId, betriebId), eq(projekte.kundeId, kundeId)))
      .get() ??
      db
        .select({ id: stundensaetze.satzId })
        .from(stundensaetze)
        .where(and(eq(stundensaetze.betriebId, betriebId), eq(stundensaetze.kundeId, kundeId)))
        .get(),
  );

export const kundeEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  kundeId: string,
): Ergebnis<null> => {
  if (!kundeLesen(db, kontext.betriebId, kundeId)) return nein("unbekannt");
  if (kundeVerwendet(db, kontext.betriebId, kundeId)) return nein("verwendet");
  schreiben(schreibDb, kontext, (s) => s.loeschen("kunden", { kundeId }));
  return ok(null);
};
