import type { Tag } from "@soll/arbeitszeit";
import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { schichten } from "../../db/schema.ts";
import type { Kontext, Schreiber } from "../audit/index.ts";

/*
 * Shifts taken over from a shift planner (BAULISTE.md S-706): written by an import in its one
 * transaction, each with the import, the tool and its id there, so a second import finds them.
 * They come as drafts (`veroeffentlicht_am` null): the owner publishes a week when it is right, and
 * only then are the people told (S-503).
 */

/** Where the rows come from: the import and the tool (its id, `extern_quelle`) */
export type Schichtherkunft = { importId: string; quelle: string };

export type UebernommeneSchicht = {
  standortId: string;
  tag: Tag;
  beginn: number;
  ende: number;
  pauseMinuten: number;
  rolle: string;
  nutzerId: string | null;
  externId: string;
};

/** A shift as far as an import compares it: its person, instants, break and role */
export type GespeicherteSchicht = {
  nutzerId: string | null;
  beginn: number;
  ende: number;
  pauseMinuten: number;
  rolle: string;
};

/** The shifts of the business an earlier import of the tool wrote, by their id there */
export const uebernommeneSchichten = (
  db: Db,
  betriebId: string,
  quelle: string,
): Map<string, GespeicherteSchicht> =>
  new Map(
    db
      .select({
        id: schichten.externId,
        nutzerId: schichten.nutzerId,
        beginn: schichten.beginn,
        ende: schichten.ende,
        pauseMinuten: schichten.pauseMinuten,
        rolle: schichten.rolle,
      })
      .from(schichten)
      .where(and(eq(schichten.betriebId, betriebId), eq(schichten.externQuelle, quelle)))
      .all()
      .map(({ id, ...zeile }) => [id as string, zeile] as const),
  );

/** A person's shifts in the plan, as spans */
export const schichtenDerPerson = (
  db: Db,
  betriebId: string,
  nutzerId: string,
): { beginn: number; ende: number }[] =>
  db
    .select({ beginn: schichten.beginn, ende: schichten.ende })
    .from(schichten)
    .where(
      and(
        eq(schichten.betriebId, betriebId),
        isNotNull(schichten.nutzerId),
        eq(schichten.nutzerId, nutzerId),
      ),
    )
    .all();

export const schichtenUebernehmen = (
  s: Schreiber,
  kontext: Kontext,
  herkunft: Schichtherkunft,
  neue: readonly UebernommeneSchicht[],
): void => {
  for (const { externId, ...schicht } of neue)
    s.einfuegen("schichten", {
      betriebId: kontext.betriebId,
      schichtId: crypto.randomUUID(),
      ...schicht,
      vorlageId: null,
      veroeffentlichtAm: null,
      angelegtVon: kontext.akteur,
      angelegtAm: kontext.jetzt,
      importId: herkunft.importId,
      externQuelle: herkunft.quelle,
      externId,
    });
};
