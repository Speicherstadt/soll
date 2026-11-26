import { tagInBerlin } from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import {
  abwesenheiten,
  importe,
  schichten,
  schichttausche,
  stempelungen,
} from "../../db/schema.ts";
import { schreiben } from "../audit/index.ts";
import { aussonderbarAb } from "./aufbewahrung.ts";

/*
 * Retention of imports (with their original files) and shift swaps (BAULISTE.md):
 * - Imports that brought times or absences are removed once every month of those rows has been
 *   removed; the original file is deleted only when no remaining import references its SHA-256.
 * - Shift swaps are removed two years after the end of the calendar year of their shift.
 */

const hatZeitenOderAbwesenheiten = (zahlenText: string): boolean => {
  try {
    const z = JSON.parse(zahlenText) as {
      zeiten?: { neu?: number };
      abwesenheiten?: { neu?: number };
    };
    return (z.zeiten?.neu ?? 0) + (z.abwesenheiten?.neu ?? 0) > 0;
  } catch {
    return false;
  }
};

const importNochGebraucht = (db: Db, betriebId: string, importId: string): boolean => {
  const stempel = db
    .select({ id: stempelungen.stempelId })
    .from(stempelungen)
    .where(and(eq(stempelungen.betriebId, betriebId), eq(stempelungen.importId, importId)))
    .limit(1)
    .get();
  if (stempel) return true;
  const abw = db
    .select({ id: abwesenheiten.abwesenheitId })
    .from(abwesenheiten)
    .where(and(eq(abwesenheiten.betriebId, betriebId), eq(abwesenheiten.importId, importId)))
    .limit(1)
    .get();
  return Boolean(abw);
};

export const importeAussondern = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: number,
  dateiLoeschen?: (sha256: string) => void,
) => {
  const alle = db
    .select({
      betriebId: importe.betriebId,
      importId: importe.importId,
      dateiSha256: importe.dateiSha256,
      zahlen: importe.zahlen,
    })
    .from(importe)
    .all();
  const kandidaten = new Set<string>();
  for (const imp of alle) {
    if (!hatZeitenOderAbwesenheiten(imp.zahlen)) continue;
    if (importNochGebraucht(db, imp.betriebId, imp.importId)) continue;
    schreiben(schreibDb, { betriebId: imp.betriebId, akteur: "system", jetzt }, (s) => {
      s.aussondern("importe", { importId: imp.importId });
    });
    kandidaten.add(imp.dateiSha256);
  }
  if (!dateiLoeschen) return;
  for (const sha of kandidaten) {
    const nochDa = db
      .select({ id: importe.importId })
      .from(importe)
      .where(eq(importe.dateiSha256, sha))
      .limit(1)
      .get();
    if (!nochDa) dateiLoeschen(sha);
  }
};

export const schichttauscheAussondern = (db: Db, schreibDb: SchreibDb, jetzt: number) => {
  const heute = tagInBerlin(jetzt);
  const zeilen = db
    .select({
      betriebId: schichttausche.betriebId,
      tauschId: schichttausche.tauschId,
      angebotenAm: schichttausche.angebotenAm,
      schichtEnde: schichten.ende,
    })
    .from(schichttausche)
    .leftJoin(
      schichten,
      and(
        eq(schichten.betriebId, schichttausche.betriebId),
        eq(schichten.schichtId, schichttausche.schichtId),
      ),
    )
    .all();
  for (const z of zeilen) {
    if (aussonderbarAb(z.schichtEnde ?? z.angebotenAm, 2) > heute) continue;
    schreiben(schreibDb, { betriebId: z.betriebId, akteur: "system", jetzt }, (s) => {
      s.aussondern("schichttausche", { tauschId: z.tauschId });
    });
  }
};
