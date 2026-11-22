import { type Modellabschnitt, minutenAmWochentag, type Tag } from "@soll/arbeitszeit";
import type { Lohnmodell } from "@soll/export";
import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { modellzuordnungen } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { zuordnungGesperrt } from "./abschluss.ts";
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

/**
 * The person's models with the day each holds from: each assignment from its day, or from the
 * model's own first day if that is later; a later assignment that starts on the same day holds
 */
const zeitraeume = (db: Db, betriebId: string, nutzerId: string): { ab: Tag; modell: Modell }[] => {
  const liste = db
    .select()
    .from(modellzuordnungen)
    .where(
      and(eq(modellzuordnungen.betriebId, betriebId), eq(modellzuordnungen.nutzerId, nutzerId)),
    )
    .orderBy(asc(modellzuordnungen.gueltigAb))
    .all()
    .flatMap((zuordnung) => {
      const modell = modellLesen(db, betriebId, zuordnung.modellId);
      if (!modell) return [];
      // days as text YYYY-MM-DD: the later one sorts last
      const ab = [modell.gueltigAb, zuordnung.gueltigAb].sort()[1] as Tag;
      return [{ ab, modell }];
    });
  return [...new Map(liste.map((eintrag) => [eintrag.ab, eintrag])).values()];
};

/**
 * The person's models as sections for `monatsstand` (S-208). Days a model does not hold yet are
 * caught by `sollAm`.
 */
export const modellabschnitte = (db: Db, betriebId: string, nutzerId: string): Modellabschnitt[] =>
  zeitraeume(db, betriebId, nutzerId).map(({ ab, modell }) => ({
    ab,
    sollMinuten: modell.sollMinuten,
  }));

/** The person's models as payroll needs them: wage, mini-job and surcharges (S-308) */
export const lohnmodelle = (db: Db, betriebId: string, nutzerId: string): Lohnmodell[] =>
  zeitraeume(db, betriebId, nutzerId).map(({ ab, modell }) => ({
    ab,
    sollMinuten: modell.sollMinuten,
    lohnArt: modell.lohnArt,
    lohnCent: modell.lohnCent,
    minijob: modell.minijob,
    zuschlagssaetze: modell.zuschlagssaetze,
  }));

export type ZuordnungErgebnis =
  | { ok: true }
  | { ok: false; grund: "modell_unbekannt" | "abgeschlossen" };

/** The day of the next assignment after `tag`, or null: an assignment holds until then */
const naechsteZuordnung = (db: Db, betriebId: string, nutzerId: string, tag: Tag): Tag | null =>
  db
    .select({ gueltigAb: modellzuordnungen.gueltigAb })
    .from(modellzuordnungen)
    .where(
      and(
        eq(modellzuordnungen.betriebId, betriebId),
        eq(modellzuordnungen.nutzerId, nutzerId),
        gt(modellzuordnungen.gueltigAb, tag),
      ),
    )
    .orderBy(asc(modellzuordnungen.gueltigAb))
    .get()?.gueltigAb ?? null;

/**
 * Assigns a model of the business to a person from a day on; the same day again replaces it. Refused
 * when it would change the Soll of a month closed for the person (S-306).
 */
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
  const bis = naechsteZuordnung(db, kontext.betriebId, angaben.nutzerId, angaben.gueltigAb);
  if (zuordnungGesperrt(db, kontext.betriebId, angaben.nutzerId, angaben.gueltigAb, bis))
    return { ok: false, grund: "abgeschlossen" };
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
