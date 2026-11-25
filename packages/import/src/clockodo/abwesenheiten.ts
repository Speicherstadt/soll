import { istTag } from "@soll/arbeitszeit";
import type { ImportAbwesenheit, LeseFehler } from "../modell.ts";
import { type Abwesenheit, BEANTRAGT, GENEHMIGT, typName } from "./bestand.ts";

/*
 * Clockodo's absences in the common model (BAULISTE.md S-703). Only an approved one happened; a
 * reported one waits for a decision nobody will make in Clockodo any more, so the owner sees its
 * line; declined and cancelled ones never were. Soll takes whole days only (docs/plan.md,
 * "Abwesenheiten aus einem Import"): half a day or hours of overtime reduction as a whole day would
 * cost the person more leave or overtime than Clockodo booked, so their line is named instead.
 */

const alsAbwesenheit = (
  satz: Abwesenheit,
  person: (nutzer: string) => string,
): ImportAbwesenheit | LeseFehler | null => {
  const { zeile } = satz;
  if (satz.status === BEANTRAGT) return { zeile, grund: "nicht_genehmigt", feld: "status" };
  if (satz.status !== GENEHMIGT) return null;
  if (!istTag(satz.von)) return { zeile, grund: "datum_ungueltig", feld: "date_since" };
  if (!istTag(satz.bis) || satz.bis < satz.von)
    return { zeile, grund: "datum_ungueltig", feld: "date_until", wert: satz.bis };
  if (satz.stunden !== null || (satz.tage !== null && !Number.isInteger(satz.tage)))
    return { zeile, grund: "teil_tag", feld: satz.stunden !== null ? "count_hours" : "count_days" };
  return {
    externalId: satz.id,
    zeile,
    person: person(satz.nutzer),
    art: typName(satz.typ),
    von: satz.von,
    bis: satz.bis,
  };
};

export const abwesenheitenAus = (
  saetze: readonly Abwesenheit[],
  person: (nutzer: string) => string,
): { abwesenheiten: ImportAbwesenheit[]; fehler: LeseFehler[] } => {
  const abwesenheiten: ImportAbwesenheit[] = [];
  const fehler: LeseFehler[] = [];
  for (const satz of saetze) {
    const ergebnis = alsAbwesenheit(satz, person);
    if (ergebnis === null) continue;
    if ("grund" in ergebnis) fehler.push(ergebnis);
    else abwesenheiten.push(ergebnis);
  }
  return { abwesenheiten, fehler };
};
