import { minutenAmWochentag, type Tag } from "@soll/arbeitszeit";
import { and, desc, eq, lte } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { modellzuordnungen } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { type Modell, modellLesen } from "./modelle.ts";

/** The assignment in force on a day: the latest one on or before it */
const zuordnungAm = (db: Db, betriebId: string, nutzerId: string, tag: Tag) =>
  db
    .select()
    .from(modellzuordnungen)
    .where(
      and(
        eq(modellzuordnungen.betriebId, betriebId),
        eq(modellzuordnungen.nutzerId, nutzerId),
        lte(modellzuordnungen.gueltigAb, tag),
      ),
    )
    .orderBy(desc(modellzuordnungen.gueltigAb))
    .get();

/** The model that holds for a person on a day, if one is assigned and holds by then */
export const modellAm = (db: Db, betriebId: string, nutzerId: string, tag: Tag): Modell | null => {
  const zuordnung = zuordnungAm(db, betriebId, nutzerId, tag);
  const modell = zuordnung ? modellLesen(db, betriebId, zuordnung.modellId) : undefined;
  return modell !== undefined && modell.gueltigAb <= tag ? modell : null;
};

/**
 * The target minutes of a day from the person's model, Monday first; null without a model
 * ("nicht hinterlegt"), never the value of another model or day (CLAUDE.md, "Never")
 */
export const sollAm = (db: Db, betriebId: string, nutzerId: string, tag: Tag): number | null => {
  const modell = modellAm(db, betriebId, nutzerId, tag);
  return modell === null ? null : minutenAmWochentag(modell.sollMinuten, tag);
};

export type ZuordnungErgebnis = { ok: true } | { ok: false; grund: "modell_unbekannt" };

/** Assigns a model of the business to a person from a day on; the same day again replaces it */
export const modellZuordnen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { nutzerId: string; modellId: string; gueltigAb: Tag },
): ZuordnungErgebnis => {
  if (!modellLesen(db, kontext.betriebId, angaben.modellId))
    return { ok: false, grund: "modell_unbekannt" };
  const schluessel = { nutzerId: angaben.nutzerId, gueltigAb: angaben.gueltigAb };
  const bisher = db
    .select({ modellId: modellzuordnungen.modellId })
    .from(modellzuordnungen)
    .where(
      and(
        eq(modellzuordnungen.betriebId, kontext.betriebId),
        eq(modellzuordnungen.nutzerId, angaben.nutzerId),
        eq(modellzuordnungen.gueltigAb, angaben.gueltigAb),
      ),
    )
    .get();
  if (bisher?.modellId === angaben.modellId) return { ok: true };
  schreiben(schreibDb, kontext, (s) =>
    bisher
      ? s.aendern("modellzuordnungen", schluessel, { modellId: angaben.modellId })
      : s.einfuegen("modellzuordnungen", {
          betriebId: kontext.betriebId,
          ...schluessel,
          modellId: angaben.modellId,
          angelegtAm: kontext.jetzt,
        }),
  );
  return { ok: true };
};
