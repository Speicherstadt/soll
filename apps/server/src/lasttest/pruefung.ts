import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/oeffnen.ts";
import { stempelungen } from "../db/schema.ts";
import { kettePruefen } from "../modules/audit/index.ts";
import type { Person } from "./lauf.ts";

/**
 * What the database holds after the load test (BAULISTE.md S-904): every person's stamp landed
 * exactly once, and each business's audit chain verifies without a finding.
 */
export type Pruefung = {
  /** "kommen" stamps of the test's people */
  gestempelt: number;
  /** people without a stamp, or with more than one */
  nichtGenauEinmal: number;
  /** businesses whose chain check found something */
  kettenMitBefund: number;
  /** milliseconds between the first and the last stamp's server time */
  spanneMs: number;
  ok: boolean;
};

const schluessel = (betriebId: string, nutzerId: string) => `${betriebId}/${nutzerId}`;

export const pruefen = (
  db: Db,
  betriebIds: readonly string[],
  personen: readonly Pick<Person, "betriebId" | "nutzerId">[],
): Pruefung => {
  const zeilen = db
    .select({
      betriebId: stempelungen.betriebId,
      nutzerId: stempelungen.nutzerId,
      zeitpunkt: stempelungen.zeitpunkt,
    })
    .from(stempelungen)
    .where(and(inArray(stempelungen.betriebId, [...betriebIds]), eq(stempelungen.art, "kommen")))
    .all();
  const anzahl = new Map<string, number>();
  for (const z of zeilen) {
    const k = schluessel(z.betriebId, z.nutzerId);
    anzahl.set(k, (anzahl.get(k) ?? 0) + 1);
  }
  const nichtGenauEinmal = personen.filter(
    (p) => anzahl.get(schluessel(p.betriebId, p.nutzerId)) !== 1,
  ).length;
  const kettenMitBefund = betriebIds.filter((id) => kettePruefen(db, id).length > 0).length;
  const zeiten = zeilen.map((z) => z.zeitpunkt);
  const spanneMs = zeiten.length > 0 ? Math.max(...zeiten) - Math.min(...zeiten) : 0;
  return {
    gestempelt: zeilen.length,
    nichtGenauEinmal,
    kettenMitBefund,
    spanneMs,
    // each person once and no row more: so no stamp of anyone else either
    ok: zeilen.length === personen.length && nichtGenauEinmal === 0 && kettenMitBefund === 0,
  };
};
