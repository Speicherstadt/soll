import { and, eq, or } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { schichttausche } from "../../db/schema.ts";
import { iso } from "./zeit.ts";

/*
 * The shift swaps of the person (S-504): those offered, offered to the person by name, or taken over
 * by the person; without the other person of the swap or whoever decided it (Art. 15 Abs. 4 DSGVO).
 * The reason of a refusal only for the parties, who were told it.
 */

type Rolle = "anbieter" | "angeboten" | "uebernehmer";

export const tauschteil = (db: Db, betriebId: string, nutzerId: string) => {
  const zeilen = db
    .select()
    .from(schichttausche)
    .where(
      and(
        eq(schichttausche.betriebId, betriebId),
        or(
          eq(schichttausche.anbieterId, nutzerId),
          eq(schichttausche.anNutzerId, nutzerId),
          eq(schichttausche.uebernehmerId, nutzerId),
        ),
      ),
    )
    .orderBy(schichttausche.angebotenAm)
    .all();
  return {
    schichttausche: zeilen.map((zeile) => {
      const rollen: Rolle[] = [
        ...(zeile.anbieterId === nutzerId ? (["anbieter"] as const) : []),
        ...(zeile.anNutzerId === nutzerId ? (["angeboten"] as const) : []),
        ...(zeile.uebernehmerId === nutzerId ? (["uebernehmer"] as const) : []),
      ];
      const partei = zeile.anbieterId === nutzerId || zeile.uebernehmerId === nutzerId;
      return {
        tauschId: zeile.tauschId,
        schichtId: zeile.schichtId,
        deineRolle: rollen,
        status: zeile.status,
        angebotenAm: iso(zeile.angebotenAm),
        uebernommenAm: zeile.uebernommenAm === null ? null : iso(zeile.uebernommenAm),
        entschiedenAm: zeile.entschiedenAm === null ? null : iso(zeile.entschiedenAm),
        grund: partei ? zeile.grund : null,
      };
    }),
  };
};

export type Tauschteil = ReturnType<typeof tauschteil>;
