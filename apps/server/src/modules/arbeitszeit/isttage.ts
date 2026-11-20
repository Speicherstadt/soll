import { type Arbeitstag, arbeitstage } from "@soll/arbeitszeit";
import type { Db } from "../../db/oeffnen.ts";
import { stempelungenIn } from "./stempelungen.ts";

/**
 * A person's working days from the stamps in force from `von` up to `bis` (instants): what the plan
 * check reads as worked before today (S-502); `bis` is now, so that a shift of yesterday ends with
 * the stamp of this morning. Stamps the rules refuse as invalid give no days.
 */
export const istTage = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  von: number,
  bis: number,
): Arbeitstag[] => {
  const ergebnis = arbeitstage(stempelungenIn(db, betriebId, nutzerId, von, bis), bis);
  return ergebnis.ok ? ergebnis.wert : [];
};
