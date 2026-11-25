import { schichtZeiten, type Tag, uhrzeitenVon } from "@soll/arbeitszeit";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { rufdienste } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { type Rufdienst, rufdienstLesen } from "../plandaten/index.ts";
import type { Meldung, Zeitraum } from "./meldungen.ts";
import { type Verweisfehler, verweisFehler } from "./verweise.ts";

/*
 * Rufbereitschaft in the plan (S-505): planned like a shift, a draft until the week is published,
 * then told and in the calendar. It is no working time itself, only its call-outs are (R-12); with
 * a reaction time under 30 minutes, or none set, the rules count it fully (EuGH C-518/15, Matzak).
 */

export type { Rufdienst };

/** A Rufbereitschaft as typed: a day and times on the Berlin clock, the reaction time if agreed */
export type RufdienstAngaben = {
  standortId: string;
  nutzerId: string;
  tag: Tag;
  beginnMinute: number;
  endeMinute: number;
  reaktionMinuten: number | null;
};

export type RufdienstErgebnis =
  | { ok: true; rufdienst: Rufdienst; meldungen: Meldung[] }
  | { ok: false; grund: Verweisfehler | "unbekannt" | "zeit_gibt_es_nicht" };

/** The Rufbereitschaft of a site beginning from `von` through `bis`, drafts included */
export const rufdiensteZwischen = (
  db: Db,
  betriebId: string,
  standortId: string,
  von: Tag,
  bis: Tag,
): Rufdienst[] =>
  db
    .select()
    .from(rufdienste)
    .where(
      and(
        eq(rufdienste.betriebId, betriebId),
        eq(rufdienste.standortId, standortId),
        gte(rufdienste.tag, von),
        lte(rufdienste.tag, bis),
      ),
    )
    .orderBy(asc(rufdienste.beginn))
    .all();

const zeile = (db: Db, betriebId: string, angaben: RufdienstAngaben) => {
  const fehler = verweisFehler(db, betriebId, angaben);
  if (fehler) return { ok: false as const, grund: fehler };
  const zeiten = schichtZeiten(angaben.tag, angaben.beginnMinute, angaben.endeMinute);
  if (!zeiten) return { ok: false as const, grund: "zeit_gibt_es_nicht" as const };
  return {
    ok: true as const,
    werte: {
      standortId: angaben.standortId,
      nutzerId: angaben.nutzerId,
      tag: angaben.tag,
      ...zeiten,
      reaktionMinuten: angaben.reaktionMinuten,
    },
  };
};

const FELDER = ["standortId", "nutzerId", "tag", "beginn", "ende", "reaktionMinuten"] as const;

const zeitraum = (dienst: Rufdienst): Zeitraum => ({
  schichtId: dienst.rufdienstId,
  tag: dienst.tag,
  beginn: dienst.beginn,
  ende: dienst.ende,
});

/**
 * Whom a change to a Rufbereitschaft has to be told: only a published one tells anyone, the person
 * it was for and the person it is for now, as for a shift (S-503)
 */
export const rufMeldungen = (alt: Rufdienst, neu: Rufdienst | null): Meldung[] => {
  if (alt.veroeffentlichtAm === null) return [];
  const entfaellt = {
    art: "ruf_entfaellt" as const,
    nutzerId: alt.nutzerId,
    schicht: zeitraum(alt),
  };
  if (neu === null) return [entfaellt];
  if (!FELDER.some((feld) => alt[feld] !== neu[feld])) return [];
  if (alt.nutzerId === neu.nutzerId)
    return [{ art: "ruf_geaendert", nutzerId: neu.nutzerId, schicht: zeitraum(neu) }];
  return [entfaellt, { art: "ruf_neu", nutzerId: neu.nutzerId, schicht: zeitraum(neu) }];
};

/** Plans a Rufbereitschaft as a draft (S-503) */
export const rufdienstAnlegen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: RufdienstAngaben,
): RufdienstErgebnis => {
  const neu = zeile(db, kontext.betriebId, angaben);
  if (!neu.ok) return neu;
  const rufdienst = schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("rufdienste", {
      betriebId: kontext.betriebId,
      rufdienstId: crypto.randomUUID(),
      ...neu.werte,
      angelegtVon: kontext.akteur,
      angelegtAm: kontext.jetzt,
    }),
  );
  return { ok: true, rufdienst, meldungen: [] };
};

/**
 * Changes a Rufbereitschaft; what is not given stays, a move keeps its times on the clock. A change
 * to a published one is published at once and told; a change that changes nothing writes nothing.
 */
export const rufdienstAendern = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  rufdienstId: string,
  aenderung: { [K in keyof RufdienstAngaben]?: RufdienstAngaben[K] | undefined },
): RufdienstErgebnis => {
  const alt = rufdienstLesen(db, kontext.betriebId, rufdienstId);
  if (!alt) return { ok: false, grund: "unbekannt" };
  const angaben: RufdienstAngaben = {
    standortId: alt.standortId,
    nutzerId: alt.nutzerId,
    tag: alt.tag,
    ...uhrzeitenVon(alt),
    reaktionMinuten: alt.reaktionMinuten,
    ...Object.fromEntries(Object.entries(aenderung).filter(([, wert]) => wert !== undefined)),
  };
  const neu = zeile(db, kontext.betriebId, angaben);
  if (!neu.ok) return neu;
  const kandidat = { ...alt, ...neu.werte };
  if (!FELDER.some((feld) => alt[feld] !== kandidat[feld]))
    return { ok: true, rufdienst: alt, meldungen: [] };
  const veroeffentlichtAm = alt.veroeffentlichtAm === null ? null : kontext.jetzt;
  const rufdienst = schreiben(schreibDb, kontext, (s) =>
    s.aendern("rufdienste", { rufdienstId }, { ...neu.werte, veroeffentlichtAm }),
  );
  return { ok: true, rufdienst, meldungen: rufMeldungen(alt, rufdienst) };
};

/** Removes a Rufbereitschaft; null when the business has none such, else whom to tell */
export const rufdienstEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  rufdienstId: string,
): Meldung[] | null => {
  const alt = rufdienstLesen(db, kontext.betriebId, rufdienstId);
  if (!alt) return null;
  schreiben(schreibDb, kontext, (s) => s.loeschen("rufdienste", { rufdienstId }));
  return rufMeldungen(alt, null);
};
