import { type PlanSchicht, schichtZeiten, type Tag, uhrzeitenVon } from "@soll/arbeitszeit";
import { and, eq, gte, lte } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { schichten } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { aenderungsMeldungen, type Meldung, unterscheidet } from "./meldungen.ts";
import { offeneBeenden, offeneTauscheDer } from "./tauschdaten.ts";
import { type Verweisfehler, verweisFehler } from "./verweise.ts";

export type Schicht = typeof schichten.$inferSelect & PlanSchicht;

/** A shift as typed: a day and times on the Berlin clock (S-501) */
export type SchichtAngaben = {
  standortId: string;
  tag: Tag;
  beginnMinute: number;
  endeMinute: number;
  pauseMinuten: number;
  rolle: string;
  nutzerId: string | null;
  vorlageId: string | null;
};

/** `meldungen`: whom a change to a published shift has to be told (S-503) */
export type SchichtErgebnis =
  | { ok: true; schicht: Schicht; meldungen: Meldung[] }
  | { ok: false; grund: Verweisfehler | "unbekannt" | "zeit_gibt_es_nicht" | "pause_zu_lang" };

const MINUTE = 60_000;

const dieser = (betriebId: string, schichtId: string) =>
  and(eq(schichten.betriebId, betriebId), eq(schichten.schichtId, schichtId));

export const schichtLesen = (db: Db, betriebId: string, schichtId: string): Schicht | undefined =>
  db.select().from(schichten).where(dieser(betriebId, schichtId)).get();

/** The shifts of a site that begin from `von` through `bis`; drafts only for whoever plans */
export const schichtenZwischen = (
  db: Db,
  betriebId: string,
  standortId: string,
  von: Tag,
  bis: Tag,
): Schicht[] =>
  db
    .select()
    .from(schichten)
    .where(
      and(
        eq(schichten.betriebId, betriebId),
        eq(schichten.standortId, standortId),
        gte(schichten.tag, von),
        lte(schichten.tag, bis),
      ),
    )
    .orderBy(schichten.beginn)
    .all();

/** The row of a shift from what was typed, or why it cannot be one */
const zeile = (
  db: Db,
  betriebId: string,
  angaben: SchichtAngaben,
): Exclude<SchichtErgebnis, { ok: true }> | { ok: true; werte: Omit<PlanSchicht, "schichtId"> } => {
  const fehler = verweisFehler(db, betriebId, angaben);
  if (fehler) return { ok: false, grund: fehler };
  const zeiten = schichtZeiten(angaben.tag, angaben.beginnMinute, angaben.endeMinute);
  if (!zeiten) return { ok: false, grund: "zeit_gibt_es_nicht" };
  if (angaben.pauseMinuten * MINUTE >= zeiten.ende - zeiten.beginn)
    return { ok: false, grund: "pause_zu_lang" };
  return {
    ok: true,
    werte: {
      standortId: angaben.standortId,
      tag: angaben.tag,
      ...zeiten,
      pauseMinuten: angaben.pauseMinuten,
      rolle: angaben.rolle,
      nutzerId: angaben.nutzerId,
    },
  };
};

export const schichtAnlegen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: SchichtAngaben,
): SchichtErgebnis => {
  const neu = zeile(db, kontext.betriebId, angaben);
  if (!neu.ok) return neu;
  const schicht = schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("schichten", {
      betriebId: kontext.betriebId,
      schichtId: crypto.randomUUID(),
      ...neu.werte,
      vorlageId: angaben.vorlageId,
      angelegtVon: kontext.akteur,
      angelegtAm: kontext.jetzt,
    }),
  );
  return { ok: true, schicht, meldungen: [] };
};

/**
 * Changes a shift: moving it to another day or person (drag and drop) keeps its times on the clock
 * (`verschoben` in packages/arbeitszeit), so a night shift stays 22:00 to 6:00 across a change of
 * clocks. What is not given stays. It ends the shift's open swaps (S-504). A change to a published shift is published at once and is a new
 * notice (`veroeffentlicht_am`, § 12 TzBfG, S-503); a change that changes nothing writes nothing.
 */
export const schichtAendern = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  schichtId: string,
  aenderung: { [K in keyof Omit<SchichtAngaben, "vorlageId">]?: SchichtAngaben[K] | undefined },
): SchichtErgebnis => {
  const alt = schichtLesen(db, kontext.betriebId, schichtId);
  if (!alt) return { ok: false, grund: "unbekannt" };
  const angaben: SchichtAngaben = {
    standortId: alt.standortId,
    tag: alt.tag,
    ...uhrzeitenVon(alt),
    pauseMinuten: alt.pauseMinuten,
    rolle: alt.rolle,
    nutzerId: alt.nutzerId,
    vorlageId: null,
    ...Object.fromEntries(Object.entries(aenderung).filter(([, wert]) => wert !== undefined)),
  };
  const neu = zeile(db, kontext.betriebId, angaben);
  if (!neu.ok) return neu;
  if (!unterscheidet(alt, neu.werte)) return { ok: true, schicht: alt, meldungen: [] };
  const veroeffentlichtAm = alt.veroeffentlichtAm === null ? null : kontext.jetzt;
  const offene = offeneTauscheDer(db, kontext.betriebId, schichtId);
  const schicht = schreiben(schreibDb, kontext, (s) => {
    offeneBeenden(s, offene, kontext);
    return s.aendern("schichten", { schichtId }, { ...neu.werte, veroeffentlichtAm });
  });
  return { ok: true, schicht, meldungen: aenderungsMeldungen(alt, schicht) };
};

/**
 * Removes a shift; null when the business has no such shift, else whom its removal has to be told:
 * a published shift leaves the calendar of its person (S-503)
 */
export const schichtEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  schichtId: string,
): Meldung[] | null => {
  const alt = schichtLesen(db, kontext.betriebId, schichtId);
  if (!alt) return null;
  const offene = offeneTauscheDer(db, kontext.betriebId, schichtId);
  schreiben(schreibDb, kontext, (s) => {
    offeneBeenden(s, offene, kontext);
    s.loeschen("schichten", { schichtId });
  });
  return aenderungsMeldungen(alt, null);
};
