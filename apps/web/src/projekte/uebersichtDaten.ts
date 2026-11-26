import type { BudgetZeile } from "@soll/arbeitszeit";
import type { Kunde, Projekt, Taetigkeit } from "./typen.ts";

export type ProjekteUebersicht = {
  aktiveAuftraege: number;
  budgetWarnungen: number;
  aktiveKunden: number;
  aktiveTaetigkeiten: number;
  abrechenbareTaetigkeiten: number;
};

/** Clamps a budget consumption line to 0..100 % for progress bar rendering. */
export const budgetProzent = (zeile: BudgetZeile): number => {
  if (zeile.budget <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((zeile.verbraucht / zeile.budget) * 100)));
};

/** Aggregates active order, customer, activity, and budget-warning counts for the /projekte KPI strip. */
export const projekteUebersichtDaten = (daten: {
  projekte: readonly Projekt[];
  kunden: readonly Kunde[];
  taetigkeiten: readonly Taetigkeit[];
}): ProjekteUebersicht => {
  const aktiveAuftraegeListe = daten.projekte.filter((p) => p.archiviertAm === null);
  const budgetWarnungen = aktiveAuftraegeListe.filter((p) =>
    (p.budget ?? []).some((b) => b.stufe === "warnung" || b.stufe === "aufgebraucht"),
  ).length;
  const aktiveKunden = daten.kunden.filter((k) => k.archiviertAm === null).length;
  const aktiveTaetigkeitenListe = daten.taetigkeiten.filter((t) => t.archiviertAm === null);
  const abrechenbareTaetigkeiten = aktiveTaetigkeitenListe.filter((t) => t.abrechenbar).length;

  return {
    aktiveAuftraege: aktiveAuftraegeListe.length,
    budgetWarnungen,
    aktiveKunden,
    aktiveTaetigkeiten: aktiveTaetigkeitenListe.length,
    abrechenbareTaetigkeiten,
  };
};
