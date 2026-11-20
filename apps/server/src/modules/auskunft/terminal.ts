import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { ausweise } from "../../db/schema.ts";
import { iso } from "./zeit.ts";

/*
 * The person's QR code for the terminal (S-801): when and by whom it was issued, or null. Its hash
 * stays out like the hash of the PIN: it protects the code, which is a secret on the printed card.
 */
export const terminalteil = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  name: (nutzerId: string) => string,
) => {
  const zeile = db
    .select()
    .from(ausweise)
    .where(and(eq(ausweise.betriebId, betriebId), eq(ausweise.nutzerId, nutzerId)))
    .get();
  return {
    ausweis: zeile
      ? { ausgestelltAm: iso(zeile.ausgestelltAm), ausgestelltVon: name(zeile.ausgestelltVon) }
      : null,
  };
};

export type Terminalteil = ReturnType<typeof terminalteil>;
