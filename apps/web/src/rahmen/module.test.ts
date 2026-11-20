import type { Module } from "@soll/arbeitszeit";
import { describe, expect, it } from "vitest";
import { ALLE_MODULE, sichtbar, tabPfade } from "./module.ts";

const FREELANCER: Module = {
  arbeitszeit: false,
  dienstplan: false,
  projektzeit: true,
  terminal: false,
};
const CAFE: Module = { arbeitszeit: true, dienstplan: true, projektzeit: false, terminal: false };
const SHK: Module = { arbeitszeit: true, dienstplan: false, projektzeit: true, terminal: true };

describe("the areas of a business's modules", () => {
  it("hides the areas of a switched-off module, never Heute, Auswertungen or Einstellungen", () => {
    const pfade = [
      "/",
      "/zeiten",
      "/abwesenheiten",
      "/dienstplan",
      "/projekte",
      "/auswertungen",
      "/einstellungen",
    ];
    expect(pfade.filter((pfad) => sichtbar(FREELANCER, pfad))).toEqual([
      "/",
      "/projekte",
      "/auswertungen",
      "/einstellungen",
    ]);
    expect(pfade.filter((pfad) => sichtbar(CAFE, pfad))).toEqual([
      "/",
      "/zeiten",
      "/abwesenheiten",
      "/dienstplan",
      "/auswertungen",
      "/einstellungen",
    ]);
    expect(pfade.filter((pfad) => sichtbar(ALLE_MODULE, pfad))).toEqual(pfade);
  });

  it("hides the month's closing without working time (S-306)", () => {
    expect(sichtbar(FREELANCER, "/monat")).toBe(false);
    expect(sichtbar(CAFE, "/monat")).toBe(true);
  });

  it("fills the tab bar with Heute, two areas of the modules and Mehr", () => {
    expect(tabPfade(ALLE_MODULE)).toEqual(["/", "/dienstplan", "/abwesenheiten", "/mehr"]);
    expect(tabPfade(CAFE)).toEqual(["/", "/dienstplan", "/abwesenheiten", "/mehr"]);
    expect(tabPfade(SHK)).toEqual(["/", "/abwesenheiten", "/projekte", "/mehr"]);
    expect(tabPfade(FREELANCER)).toEqual(["/", "/projekte", "/mehr"]);
  });
});
