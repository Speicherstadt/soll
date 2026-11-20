import type { Monat } from "@soll/arbeitszeit";
import { type DatevExportErgebnis, type DatevZiel, datevExport } from "@soll/export";
import type { Db } from "../../db/oeffnen.ts";
import { lohndaten } from "../arbeitszeit/index.ts";
import { einstellungenLesen } from "./einstellungen.ts";

/** The DATEV payroll export of a business (S-308): its mapping and the file of a closed month */
export {
  einstellungenLesen,
  einstellungenSetzen,
  type NeueEinstellungen,
  type SetzenErgebnis,
} from "./einstellungen.ts";

/**
 * The file of a month for LODAS or Lohn und Gehalt from the months the business closed, or what is
 * "nicht hinterlegt". It only reads: the closed months and the mapping stay as they are.
 */
export const datevDatei = (
  db: Db,
  betriebId: string,
  monat: Monat,
  ziel: DatevZiel,
): DatevExportErgebnis =>
  datevExport({
    ziel,
    monat,
    einstellungen: einstellungenLesen(db, betriebId),
    ...lohndaten(db, betriebId, monat),
  });
