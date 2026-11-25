import type { Abwesenheitsart, Stempelart, Tag } from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { abwesenheiten, stempelungen } from "../../db/schema.ts";
import type { Kontext, Schreiber } from "../audit/index.ts";

/*
 * Stamps and absences taken over from another tool (S-701): written by an import in its one
 * transaction, each with the import, the tool and its id there, so a second import finds them.
 * A taken-over stamp is an original (no reason, nothing replaced); a correction of it later is a
 * row of its own without the id, as for every stamp (S-304).
 */

/** Where the rows come from: the import and the tool (its id, `extern_quelle`) */
export type Herkunft = { importId: string; quelle: string };

export type UebernommenerStempel = {
  nutzerId: string;
  art: Stempelart;
  zeitpunkt: number;
  externId: string;
};

export type UebernommeneAbwesenheit = {
  nutzerId: string;
  art: Abwesenheitsart;
  von: Tag;
  bis: Tag;
  externId: string;
};

/**
 * The ids in the old tool that stamps and absences of the business already carry, each with what
 * the row holds: its person, and the instant of a stamp or the kind and span of an absence
 */
export const uebernommeneKennungen = (db: Db, betriebId: string, quelle: string) => ({
  stempelungen: new Map(
    db
      .select({
        id: stempelungen.externId,
        nutzerId: stempelungen.nutzerId,
        zeitpunkt: stempelungen.zeitpunkt,
      })
      .from(stempelungen)
      .where(and(eq(stempelungen.betriebId, betriebId), eq(stempelungen.externQuelle, quelle)))
      .all()
      .map(({ id, ...zeile }) => [id as string, zeile] as const),
  ),
  abwesenheiten: new Map(
    db
      .select({
        id: abwesenheiten.externId,
        nutzerId: abwesenheiten.nutzerId,
        art: abwesenheiten.art,
        von: abwesenheiten.von,
        bis: abwesenheiten.bis,
      })
      .from(abwesenheiten)
      .where(and(eq(abwesenheiten.betriebId, betriebId), eq(abwesenheiten.externQuelle, quelle)))
      .all()
      .map(({ id, ...zeile }) => [id as string, zeile] as const),
  ),
});

export const stempelUebernehmen = (
  s: Schreiber,
  kontext: Kontext,
  herkunft: Herkunft,
  neue: readonly UebernommenerStempel[],
): void => {
  for (const stempel of neue)
    s.einfuegen("stempelungen", {
      betriebId: kontext.betriebId,
      stempelId: crypto.randomUUID(),
      nutzerId: stempel.nutzerId,
      art: stempel.art,
      zeitpunkt: stempel.zeitpunkt,
      geraetZeitpunkt: null,
      quelle: "import",
      ersetzt: null,
      grund: null,
      erstelltVon: kontext.akteur,
      erstelltAm: kontext.jetzt,
      importId: herkunft.importId,
      externQuelle: herkunft.quelle,
      externId: stempel.externId,
    });
};

/** Approved: the old tool granted them or they happened (docs/plan.md, "Import") */
export const abwesenheitenUebernehmen = (
  s: Schreiber,
  kontext: Kontext,
  herkunft: Herkunft,
  neue: readonly UebernommeneAbwesenheit[],
): void => {
  for (const abwesenheit of neue)
    s.einfuegen("abwesenheiten", {
      betriebId: kontext.betriebId,
      abwesenheitId: crypto.randomUUID(),
      nutzerId: abwesenheit.nutzerId,
      art: abwesenheit.art,
      von: abwesenheit.von,
      bis: abwesenheit.bis,
      status: "genehmigt",
      entschiedenVon: kontext.akteur,
      entschiedenAm: kontext.jetzt,
      erstelltVon: kontext.akteur,
      erstelltAm: kontext.jetzt,
      importId: herkunft.importId,
      externQuelle: herkunft.quelle,
      externId: abwesenheit.externId,
    });
};
