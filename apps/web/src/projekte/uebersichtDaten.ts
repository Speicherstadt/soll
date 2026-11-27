import type { BudgetZeile } from "@soll/arbeitszeit";
import type { Kunde, Projekt, Taetigkeit } from "./typen.ts";

export type KundenChip = { kundeId: string; name: string; auftraege: number };

export type ProjekteUebersicht = {
  aktiveAuftraege: number;
  budgetWarnungen: number;
  budgetVerbrauchtMinuten: number;
  budgetGesamtMinuten: number;
  budgetAnteilProzent: number | null;
  aktiveKunden: number;
  topKunden: KundenChip[];
  aktiveTaetigkeiten: number;
  abrechenbareTaetigkeiten: number;
  abrechenbarProzent: number;
  taetigkeitNamen: string[];
};

/** Clamps a budget consumption line to 0..100 % for progress bar rendering. */
export const budgetProzent = (zeile: BudgetZeile): number => {
  if (zeile.budget <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((zeile.verbraucht / zeile.budget) * 100)));
};

/** Aggregates active order, budget ring, customer distribution, and activity metrics for /projekte. */
export const projekteUebersichtDaten = (daten: {
  projekte: readonly Projekt[];
  kunden: readonly Kunde[];
  taetigkeiten: readonly Taetigkeit[];
}): ProjekteUebersicht => {
  const aktiveAuftraegeListe = daten.projekte.filter((p) => p.archiviertAm === null);
  const budgetWarnungen = aktiveAuftraegeListe.filter((p) =>
    (p.budget ?? []).some((b) => b.stufe === "warnung" || b.stufe === "aufgebraucht"),
  ).length;

  let budgetVerbrauchtMinuten = 0;
  let budgetGesamtMinuten = 0;
  for (const p of aktiveAuftraegeListe) {
    const minZeile = (p.budget ?? []).find((b) => b.art === "minuten");
    if (minZeile && minZeile.budget > 0) {
      budgetVerbrauchtMinuten += Math.max(0, minZeile.verbraucht);
      budgetGesamtMinuten += minZeile.budget;
    }
  }
  const budgetAnteilProzent =
    budgetGesamtMinuten > 0
      ? Math.min(100, Math.round((budgetVerbrauchtMinuten / budgetGesamtMinuten) * 100))
      : null;

  const aktiveKundenListe = daten.kunden.filter((k) => k.archiviertAm === null);
  const auftraegeJeKunde = new Map<string, number>();
  for (const p of aktiveAuftraegeListe) {
    auftraegeJeKunde.set(p.kundeId, (auftraegeJeKunde.get(p.kundeId) ?? 0) + 1);
  }
  const topKunden = aktiveKundenListe
    .map((k) => ({
      kundeId: k.kundeId,
      name: k.name,
      auftraege: auftraegeJeKunde.get(k.kundeId) ?? 0,
    }))
    .sort((a, b) => b.auftraege - a.auftraege)
    .slice(0, 3);

  const aktiveTaetigkeitenListe = daten.taetigkeiten.filter((t) => t.archiviertAm === null);
  const abrechenbareTaetigkeiten = aktiveTaetigkeitenListe.filter((t) => t.abrechenbar).length;
  const abrechenbarProzent =
    aktiveTaetigkeitenListe.length > 0
      ? Math.round((abrechenbareTaetigkeiten / aktiveTaetigkeitenListe.length) * 100)
      : 0;
  const taetigkeitNamen = aktiveTaetigkeitenListe.slice(0, 4).map((t) => t.name);

  return {
    aktiveAuftraege: aktiveAuftraegeListe.length,
    budgetWarnungen,
    budgetVerbrauchtMinuten,
    budgetGesamtMinuten,
    budgetAnteilProzent,
    aktiveKunden: aktiveKundenListe.length,
    topKunden,
    aktiveTaetigkeiten: aktiveTaetigkeitenListe.length,
    abrechenbareTaetigkeiten,
    abrechenbarProzent,
    taetigkeitNamen,
  };
};
