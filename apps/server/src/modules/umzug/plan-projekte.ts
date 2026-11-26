import type { ImportKunde, ImportProjekt, ImportTaetigkeit, Ziel } from "@soll/import";
import type {
  Anzahl,
  NeuerKunde,
  NeuesProjekt,
  NeueTaetigkeit,
  PlanGrund,
  Stand,
} from "./plan-typen.ts";

/*
 * Customers and orders of another tool (BAULISTE.md S-701): created anew with the tool and their id
 * (`extern_quelle`, `extern_id`, S-601), matched with one the business has, or left out. One created
 * by an earlier import is found by its id and stays as it is. Activities (S-703) go the same way.
 */

export type Ergebnis<T> =
  | { art: "neu"; wert: T; id: string }
  | { art: "vorhanden"; id: string }
  | { art: "ausgelassen" }
  | { art: "abgelehnt"; grund: PlanGrund };

/** Counts a result into the numbers of its kind */
export const zaehlen = (anzahl: Anzahl, ergebnis: { art: keyof Anzahl }): void => {
  anzahl[ergebnis.art] += 1;
};

const zugeordnet = <T>(
  ziel: Ziel,
  vorhanden: ReadonlySet<string>,
  grund: PlanGrund,
): Ergebnis<T> | null => {
  if (ziel === "aus") return { art: "ausgelassen" };
  if (ziel === "neu") return null;
  return vorhanden.has(ziel.id) ? { art: "vorhanden", id: ziel.id } : { art: "abgelehnt", grund };
};

export const kundePlanen = (kunde: ImportKunde, ziel: Ziel, stand: Stand): Ergebnis<NeuerKunde> => {
  if (!stand.module.projektzeit) return { art: "abgelehnt", grund: "modul_aus" };
  const gewaehlt = zugeordnet<NeuerKunde>(ziel, stand.kunden, "kunde_unbekannt");
  if (gewaehlt) return gewaehlt;
  const frueher = stand.vorhanden.kunden.get(kunde.externalId);
  if (frueher !== undefined) return { art: "vorhanden", id: frueher };
  const kundeId = stand.neueId();
  return {
    art: "neu",
    id: kundeId,
    wert: { kundeId, name: kunde.name, nummer: kunde.nummer, externId: kunde.externalId },
  };
};

/** `kundeId`: the customer of the order in Soll, null when its customer is not taken over */
export const projektPlanen = (
  projekt: ImportProjekt,
  ziel: Ziel,
  kundeId: string | null,
  stand: Stand,
): Ergebnis<NeuesProjekt> => {
  if (!stand.module.projektzeit) return { art: "abgelehnt", grund: "modul_aus" };
  const gewaehlt = zugeordnet<NeuesProjekt>(ziel, stand.projekte, "projekt_unbekannt");
  if (gewaehlt) return gewaehlt;
  const frueher = stand.vorhanden.projekte.get(projekt.externalId);
  if (frueher !== undefined) return { art: "vorhanden", id: frueher };
  if (kundeId === null)
    return { art: "abgelehnt", grund: projekt.kunde === "" ? "kunde_fehlt" : "kunde_ausgelassen" };
  const projektId = stand.neueId();
  return {
    art: "neu",
    id: projektId,
    wert: {
      projektId,
      kundeId,
      name: projekt.name,
      nummer: projekt.nummer,
      externId: projekt.externalId,
    },
  };
};

/** An activity of another tool (S-705): like a customer, created, matched or left out */
export const taetigkeitPlanen = (
  taetigkeit: ImportTaetigkeit,
  ziel: Ziel,
  stand: Stand,
): Ergebnis<NeueTaetigkeit> => {
  if (!stand.module.projektzeit) return { art: "abgelehnt", grund: "modul_aus" };
  const gewaehlt = zugeordnet<NeueTaetigkeit>(ziel, stand.taetigkeiten, "taetigkeit_unbekannt");
  if (gewaehlt) return gewaehlt;
  const frueher = stand.vorhanden.taetigkeiten.get(taetigkeit.externalId);
  if (frueher !== undefined) return { art: "vorhanden", id: frueher };
  const taetigkeitId = stand.neueId();
  return {
    art: "neu",
    id: taetigkeitId,
    wert: { taetigkeitId, name: taetigkeit.name, externId: taetigkeit.externalId },
  };
};
