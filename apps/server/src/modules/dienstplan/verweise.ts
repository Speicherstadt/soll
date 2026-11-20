import { darf } from "../../auth/rollen.ts";
import type { Db } from "../../db/oeffnen.ts";
import { mitgliedschaftVon } from "../mitglieder/index.ts";
import { standorteLesen } from "../standorte/index.ts";
import { vorlageLesen } from "./vorlagen.ts";

/** Why a shift or template names something the business does not have */
export type Verweisfehler = "standort_unbekannt" | "person_unbekannt" | "vorlage_unbekannt";

export const standortVorhanden = (db: Db, betriebId: string, standortId: string): boolean =>
  standorteLesen(db, betriebId).some((standort) => standort.standortId === standortId);

/** Who can be planned: a member of the business who works for it and stamps (rollen.ts) */
export const planbar = (db: Db, betriebId: string, nutzerId: string): boolean => {
  const mitglied = mitgliedschaftVon(db, betriebId, nutzerId);
  return mitglied !== undefined && darf(mitglied.rolle, "stempeln");
};

/**
 * The first reference of a shift or template that lies outside the caller's business, or null: a
 * site, a person or a template of another business is refused, never written (CLAUDE.md)
 */
export const verweisFehler = (
  db: Db,
  betriebId: string,
  verweise: { standortId?: string | null; nutzerId?: string | null; vorlageId?: string | null },
): Verweisfehler | null => {
  if (verweise.standortId && !standortVorhanden(db, betriebId, verweise.standortId))
    return "standort_unbekannt";
  if (verweise.nutzerId && !planbar(db, betriebId, verweise.nutzerId)) return "person_unbekannt";
  if (verweise.vorlageId && !vorlageLesen(db, betriebId, verweise.vorlageId))
    return "vorlage_unbekannt";
  return null;
};
