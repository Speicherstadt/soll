import type { ImportAbwesenheit, LeseFehler } from "../modell.ts";
import type { Abwesenheit, Art } from "./bestand.ts";
import { ganzerTag, tagVon } from "./werte.ts";

/*
 * Personio's absence periods in the common model (BAULISTE.md S-704). Only an approved one happened
 * (`approval.status` APPROVED, or none where the type needs no approval; pysonio
 * models/absence_periods.py); one still waiting for a decision nobody will make in Personio any more
 * is named with its line, a refused one never was. Half days stay half days: an absence from the
 * second half of its first day (`starts_from.type` SECOND_HALF) has a half first day, one until the
 * first half of its last day (`ends_at.type` FIRST_HALF) a half last day (n8n-nodes-personio-hr,
 * AbsencePeriodDescription.ts). Hours are no days (docs/plan.md, "Abwesenheiten aus einem Import").
 * Of a sickness only its type comes, never a comment (Art. 9 DSGVO).
 */

const GENEHMIGT = new Set([null, "APPROVED"]);
const OFFEN = new Set(["PENDING", "SUBSTITUTE_REQUESTED", "DELETION_PENDING"]);

type Ergebnis = ImportAbwesenheit | LeseFehler | null;

/** The span in whole days with its halves, or why it is none */
const tage = (
  a: Abwesenheit,
): Omit<ImportAbwesenheit, "externalId" | "zeile" | "person" | "art"> | LeseFehler => {
  const { zeile } = a;
  if (a.ende === null) return { zeile, grund: "laeuft_noch", feld: "ends_at.date_time" };
  if (!ganzerTag(a.beginn)) return { zeile, grund: "teil_tag", feld: "starts_from.date_time" };
  if (!ganzerTag(a.ende)) return { zeile, grund: "teil_tag", feld: "ends_at.date_time" };
  const von = tagVon(a.beginn);
  const bis = tagVon(a.ende);
  if (bis < von) return { zeile, grund: "datum_ungueltig", feld: "ends_at.date_time", wert: bis };
  const ersterHalb = a.beginnHalb === "SECOND_HALF";
  const letzterHalb = a.endeHalb === "FIRST_HALF";
  // from the afternoon to the morning of the same day: no time at all
  if (von === bis && ersterHalb && letzterHalb)
    return { zeile, grund: "datum_ungueltig", feld: "ends_at.type" };
  return {
    von,
    bis,
    ...(ersterHalb ? { ersterHalb } : {}),
    ...(letzterHalb ? { letzterHalb } : {}),
  };
};

const alsAbwesenheit = (
  a: Abwesenheit,
  arten: ReadonlyMap<string, Art>,
  person: (id: string) => string,
): Ergebnis => {
  const { zeile } = a;
  if (OFFEN.has(a.status as string))
    return { zeile, grund: "nicht_genehmigt", feld: "approval.status", wert: a.status ?? "" };
  if (!GENEHMIGT.has(a.status)) return null;
  const art = arten.get(a.art);
  if (art === undefined) return { zeile, grund: "art_fehlt", feld: "absence_type.id", wert: a.art };
  if (art.stunden) return { zeile, grund: "teil_tag", feld: "absence_type.id", wert: art.name };
  const spanne = tage(a);
  if ("grund" in spanne) return spanne;
  return { externalId: a.id, zeile, person: person(a.person), art: art.name, ...spanne };
};

export const abwesenheitenAus = (
  saetze: readonly Abwesenheit[],
  arten: readonly Art[],
  person: (id: string) => string,
): { abwesenheiten: ImportAbwesenheit[]; fehler: LeseFehler[] } => {
  const nachId = new Map(arten.map((art) => [art.id, art]));
  const abwesenheiten: ImportAbwesenheit[] = [];
  const fehler: LeseFehler[] = [];
  for (const satz of saetze) {
    const ergebnis = alsAbwesenheit(satz, nachId, person);
    if (ergebnis === null) continue;
    if ("grund" in ergebnis) fehler.push(ergebnis);
    else abwesenheiten.push(ergebnis);
  }
  return { abwesenheiten, fehler };
};
