import { tagInDeutschland, type Verfahrensdoku, verfahrensdokuAus } from "@soll/export";
import type { Db } from "../../db/oeffnen.ts";
import { standLesen } from "./stand.ts";

export { angabenLesen, angabenSpeichern } from "./angaben.ts";
export { standLesen } from "./stand.ts";

/**
 * The Verfahrensdokumentation of a business from its state now (S-902), dated with today's day in
 * Europe/Berlin; null for a business that does not exist
 */
export const verfahrensdokuVon = (
  db: Db,
  betriebId: string,
  jetzt: number,
  version: string,
): Verfahrensdoku | null => {
  const stand = standLesen(db, betriebId, jetzt, version);
  return stand ? verfahrensdokuAus(stand, tagInDeutschland(jetzt)) : null;
};
