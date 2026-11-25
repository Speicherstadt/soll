import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { ausweise, karten } from "../../db/schema.ts";
import { iso } from "./zeit.ts";

/*
 * The person's QR code and NFC cards for the terminal (S-801, S-802): when and by whom each was
 * issued, the kind of card and when it was revoked. The hashes of QR code and UID, the cards' keys
 * and read counters stay out like the hash of the PIN: they protect the card, which is a secret in
 * the person's pocket.
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
  const eigeneKarten = db
    .select()
    .from(karten)
    .where(and(eq(karten.betriebId, betriebId), eq(karten.nutzerId, nutzerId)))
    .orderBy(karten.angelegtAm)
    .all();
  return {
    ausweis: zeile
      ? { ausgestelltAm: iso(zeile.ausgestelltAm), ausgestelltVon: name(zeile.ausgestelltVon) }
      : null,
    karten: eigeneKarten.map((karte) => ({
      karteId: karte.karteId,
      art: karte.art,
      eingetragenAm: iso(karte.angelegtAm),
      eingetragenVon: name(karte.angelegtVon),
      widerrufenAm: karte.widerrufenAm === null ? null : iso(karte.widerrufenAm),
    })),
  };
};

export type Terminalteil = ReturnType<typeof terminalteil>;
