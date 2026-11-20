import type { Schicht, Vorlage, Ziel } from "./typen.ts";

/**
 * Drag and drop of the plan on the browser's own API (HTML Drag and Drop): what is dragged travels
 * as a type of its own, so a text or file dragged in from elsewhere is never taken for a shift
 */
export const SCHICHT_TYP = "application/x-soll-schicht";
export const VORLAGE_TYP = "application/x-soll-vorlage";

export type Abgelegt = { schicht: Schicht } | { vorlage: Vorlage };

export const ziehbar = (event: DragEvent): boolean => {
  const typen = event.dataTransfer?.types ?? [];
  return typen.includes(SCHICHT_TYP) || typen.includes(VORLAGE_TYP);
};

/** What was dropped, found among the shifts and templates the page knows */
export const abgelegt = (
  event: DragEvent,
  schichten: readonly Schicht[],
  vorlagen: readonly Vorlage[],
): Abgelegt | null => {
  const schichtId = event.dataTransfer?.getData(SCHICHT_TYP);
  const schicht = schichten.find((kandidat) => kandidat.schichtId === schichtId);
  if (schicht) return { schicht };
  const vorlageId = event.dataTransfer?.getData(VORLAGE_TYP);
  const vorlage = vorlagen.find((kandidat) => kandidat.vorlageId === vorlageId);
  return vorlage ? { vorlage } : null;
};

export const zielSchluessel = (ziel: Ziel): string => `${ziel.nutzerId ?? "offen"}:${ziel.tag}`;
