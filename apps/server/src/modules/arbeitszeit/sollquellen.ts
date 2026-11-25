import {
  ersterTag,
  type Monat,
  type PlanSchicht,
  planSoll,
  plusMonate,
  type Sollquelle,
  type Tag,
  tageImMonat,
} from "@soll/arbeitszeit";
import { and, asc, eq, max } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { aussonderungen, monatsabschluesse, sollquellen } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { modulAktiv } from "../betrieb/index.ts";
import { veroeffentlichteSchichten } from "../plandaten/index.ts";

/*
 * Where the Soll of a business comes from (S-505): the working-time model, or from a day on the
 * published plan. A history, so a closed month keeps the source it was closed with.
 */

/** The business's sources in the order of their days */
export const sollquellenVon = (db: Db, betriebId: string): Sollquelle[] =>
  db
    .select({ ab: sollquellen.ab, quelle: sollquellen.quelle })
    .from(sollquellen)
    .where(eq(sollquellen.betriebId, betriebId))
    .orderBy(asc(sollquellen.ab))
    .all();

/** The last month any person of the business has closed (or removed after its retention), or null */
const letzterAbgeschlossenerMonat = (db: Db, betriebId: string): Monat | null => {
  const abgeschlossen = db
    .select({ monat: max(monatsabschluesse.monat) })
    .from(monatsabschluesse)
    .where(
      and(
        eq(monatsabschluesse.betriebId, betriebId),
        eq(monatsabschluesse.schritt, "abgeschlossen"),
      ),
    )
    .get()?.monat;
  const ausgesondert = db
    .select({ monat: max(aussonderungen.monat) })
    .from(aussonderungen)
    .where(eq(aussonderungen.betriebId, betriebId))
    .get()?.monat;
  const monate = [abgeschlossen, ausgesondert].filter((m): m is Monat => typeof m === "string");
  return monate.sort().at(-1) ?? null;
};

/** The first day a new source may take effect: the day after the last closed month */
export const fruehesterSollquellenTag = (db: Db, betriebId: string): Tag | null => {
  const monat = letzterAbgeschlossenerMonat(db, betriebId);
  return monat === null ? null : ersterTag(plusMonate(monat, 1));
};

export type SollquelleErgebnis =
  | { ok: true; quellen: Sollquelle[] }
  | { ok: false; grund: "monat_gesperrt" | "modul_aus" };

/**
 * Sets the source from a day on (owner only, in the route), through the audit chain: refused for a
 * day in or before a closed month, whose records it would change, and the plan while the module
 * Dienstplan is off. The same day again changes its entry.
 */
export const sollquelleSetzen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  { ab, quelle }: Sollquelle,
): SollquelleErgebnis => {
  const fruehestens = fruehesterSollquellenTag(db, kontext.betriebId);
  if (fruehestens !== null && ab < fruehestens) return { ok: false, grund: "monat_gesperrt" };
  if (quelle === "plan" && !modulAktiv(db, kontext.betriebId, "dienstplan"))
    return { ok: false, grund: "modul_aus" };
  const vorhanden = sollquellenVon(db, kontext.betriebId).some((eintrag) => eintrag.ab === ab);
  const werte = { quelle, angelegtVon: kontext.akteur, angelegtAm: kontext.jetzt };
  schreiben(schreibDb, kontext, (s) =>
    vorhanden
      ? s.aendern("sollquellen", { ab }, werte)
      : s.einfuegen("sollquellen", { betriebId: kontext.betriebId, ab, ...werte }),
  );
  return { ok: true, quellen: sollquellenVon(db, kontext.betriebId) };
};

/**
 * The days of a month whose Soll comes from the plan, with the person's published minutes on each
 * (`SollGrundlagen.plan`); an empty map while the business takes its Soll from the model
 */
export const planSollImMonat = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  monat: Monat,
): Map<Tag, number> => {
  const quellen = sollquellenVon(db, betriebId);
  if (!quellen.some((eintrag) => eintrag.quelle === "plan")) return new Map();
  const tage = tageImMonat(monat);
  const geplant: PlanSchicht[] = veroeffentlichteSchichten(
    db,
    betriebId,
    nutzerId,
    tage[0] ?? ersterTag(monat),
    tage.at(-1) ?? ersterTag(monat),
  );
  return planSoll(tage, quellen, geplant);
};
