import type { Modul, Module } from "@soll/arbeitszeit";

/**
 * Which areas a business sees: an area of a switched-off module is missing from the navigation, as its
 * routes are refused by the server (docs/plan.md, "Module"). The terminal has no area of its own; it is
 * a view on a tablet (S-801).
 */
const MODUL_VON_PFAD: Readonly<Record<string, Modul>> = {
  "/zeiten": "arbeitszeit",
  "/monat": "arbeitszeit",
  "/abwesenheiten": "arbeitszeit",
  "/dienstplan": "dienstplan",
  "/projekte": "projektzeit",
};

/** Before the business is known (offline on the first start) the app shows everything */
export const ALLE_MODULE: Module = {
  arbeitszeit: true,
  dienstplan: true,
  projektzeit: true,
  terminal: true,
};

/** An area is its first path segment: "/projekte/", "/projekte/42" and "/projekte" are one area */
const bereichVon = (pfad: string): string => `/${pfad.split("/")[1] ?? ""}`;

export const sichtbar = (module: Module, pfad: string): boolean => {
  const modul = MODUL_VON_PFAD[bereichVon(pfad)];
  return modul === undefined || module[modul];
};

/** The areas that may take a place in the tab bar, by how often a phone needs them */
const TAB_KANDIDATEN = ["/dienstplan", "/abwesenheiten", "/projekte", "/zeiten"] as const;

/** The tab bar on phones: Heute, the first two areas the business uses, and Mehr (DESIGN.md) */
export const tabPfade = (module: Module): string[] => [
  "/",
  ...TAB_KANDIDATEN.filter((pfad) => sichtbar(module, pfad)).slice(0, 2),
  "/mehr",
];
