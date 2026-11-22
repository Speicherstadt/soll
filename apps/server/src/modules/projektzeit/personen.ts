import { darf } from "../../auth/rollen.ts";
import type { Db } from "../../db/oeffnen.ts";
import { modulAktiv } from "../betrieb/index.ts";
import { mitgliedschaftVon } from "../mitglieder/index.ts";

/** Whether a member books project time (S-602), as GET /saetze/personen lists them: not a device */
export const bucht = (db: Db, betriebId: string, nutzerId: string): boolean => {
  const mitglied = mitgliedschaftVon(db, betriebId, nutzerId);
  return mitglied !== undefined && darf(mitglied.rolle, "projekte:lesen");
};

/**
 * Whether Soll records the person's working time, so their project time can be held against it:
 * the business uses working time, and the person stamps (or did)
 */
export const erfasstArbeitszeit = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  hatStempelungen: boolean,
): boolean => {
  if (!modulAktiv(db, betriebId, "arbeitszeit")) return false;
  const mitglied = mitgliedschaftVon(db, betriebId, nutzerId);
  return hatStempelungen || (mitglied !== undefined && darf(mitglied.rolle, "stempeln"));
};
