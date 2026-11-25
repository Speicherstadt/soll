import type { Zuordnung } from "@soll/import";
import type { Db } from "../../db/oeffnen.ts";
import { kundenLesen, projekteLesen, taetigkeitenLesen } from "../projektzeit/index.ts";
import { erfassteMitglieder } from "./stand.ts";

/*
 * Whether a mapping names only what belongs to the business (BAULISTE.md S-701): members who
 * stamp, customers, orders and activities of its own. A person or a customer of another business is refused
 * before anything is planned, so no import ever writes into another business's rows.
 */

export type ZuordnungFehler =
  | "person_unbekannt"
  | "kunde_unbekannt"
  | "projekt_unbekannt"
  | "taetigkeit_unbekannt";

const ids = (ziele: Zuordnung["kunden"]): string[] =>
  Object.values(ziele).flatMap((ziel) => (typeof ziel === "object" ? [ziel.id] : []));

export const zuordnungPruefen = (
  db: Db,
  betriebId: string,
  zuordnung: Zuordnung,
): ZuordnungFehler | null => {
  const mitglieder = new Set(erfassteMitglieder(db, betriebId).map((m) => m.nutzerId));
  const personen = Object.values(zuordnung.personen).filter((id): id is string => id !== null);
  if (personen.some((id) => !mitglieder.has(id))) return "person_unbekannt";
  const kunden = new Set(kundenLesen(db, betriebId).map((k) => k.kundeId));
  if (ids(zuordnung.kunden).some((id) => !kunden.has(id))) return "kunde_unbekannt";
  const projekte = new Set(projekteLesen(db, betriebId).map((p) => p.projektId));
  if (ids(zuordnung.projekte).some((id) => !projekte.has(id))) return "projekt_unbekannt";
  const taetigkeiten = new Set(taetigkeitenLesen(db, betriebId).map((t) => t.taetigkeitId));
  if (ids(zuordnung.taetigkeiten).some((id) => !taetigkeiten.has(id)))
    return "taetigkeit_unbekannt";
  return null;
};
