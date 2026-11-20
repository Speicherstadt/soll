import { betragCent, buchungsMinuten, stundensatz } from "@soll/arbeitszeit";
import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { projektzeiten } from "../../db/schema.ts";
import { projekteLesen } from "./projekte.ts";
import { saetzeLesen } from "./saetze.ts";
import { taetigkeitenLesen } from "./taetigkeiten.ts";

export type Verbrauch = { minuten: number; cent: number };

/** The rate in force for a booking, or null (nicht hinterlegt) */
const satzAm = (
  saetze: Parameters<typeof stundensatz>[0],
  buchung: Parameters<typeof stundensatz>[1],
): number | null => {
  const satz = stundensatz(saetze, buchung);
  return satz.art === "satz" ? satz.centProStunde : null;
};

/**
 * What the bookings of each order used of its budget (S-601 `budgetStand`, S-602): every booked
 * minute (a running booking up to now), and the amount of billable minutes: a billed booking at the
 * rate it was billed with, the others at the rate in force on their working day; a minute without a
 * rate (nicht hinterlegt) adds no amount, Soll guesses none.
 */
export const verbrauchJeProjekt = (
  db: Db,
  betriebId: string,
  jetzt: number,
): Map<string, Verbrauch> => {
  const kundeVon = new Map(projekteLesen(db, betriebId).map((p) => [p.projektId, p.kundeId]));
  const abrechenbar = new Set(
    taetigkeitenLesen(db, betriebId)
      .filter((taetigkeit) => taetigkeit.abrechenbar)
      .map((taetigkeit) => taetigkeit.taetigkeitId),
  );
  const saetze = saetzeLesen(db, betriebId);
  const zeilen = db
    .select()
    .from(projektzeiten)
    .where(and(eq(projektzeiten.betriebId, betriebId), isNotNull(projektzeiten.projektId)))
    .all();
  const verbrauch = new Map<string, Verbrauch>();
  for (const zeile of zeilen) {
    const projektId = zeile.projektId as string;
    const minuten = buchungsMinuten(zeile.beginn, zeile.ende, jetzt);
    const satz =
      zeile.abgerechnetAm !== null
        ? zeile.centProStunde
        : abrechenbar.has(zeile.taetigkeitId)
          ? satzAm(saetze, { ...zeile, projektId, kundeId: kundeVon.get(projektId) ?? null })
          : null;
    const bisher = verbrauch.get(projektId) ?? { minuten: 0, cent: 0 };
    verbrauch.set(projektId, {
      minuten: bisher.minuten + minuten,
      cent: bisher.cent + (satz === null ? 0 : betragCent(minuten, satz)),
    });
  }
  return verbrauch;
};
