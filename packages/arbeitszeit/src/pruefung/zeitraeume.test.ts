import { describe, expect, it } from "vitest";
import { REGELVERSIONEN } from "../jahreswerte/werte.ts";
import { ARBZG_GRENZEN, type ArbzgGrenzen, arbzgGrenzenAm } from "./grenzen.ts";
import { tageVonBis, zeitraumAm } from "./zeitraeume.ts";

const GRENZEN = ARBZG_GRENZEN["2026-1"] as ArbzgGrenzen;

describe("Ausgleichszeiträume (§ 3 Satz 2 ArbZG)", () => {
  it("puts six calendar months from the first of the start month, also backwards", () => {
    expect(zeitraumAm("2026-06-30", "sechs_monate", "2026-01-01", GRENZEN)).toEqual({
      art: "sechs_monate",
      von: "2026-01-01",
      bis: "2026-06-30",
    });
    expect(zeitraumAm("2026-07-01", "sechs_monate", "2026-01-15", GRENZEN)).toMatchObject({
      von: "2026-07-01",
      bis: "2026-12-31",
    });
    expect(zeitraumAm("2025-12-31", "sechs_monate", "2026-03-01", GRENZEN)).toMatchObject({
      von: "2025-09-01",
      bis: "2026-02-28",
    });
  });

  it("puts 24 weeks of 168 days from the start day, also backwards", () => {
    expect(zeitraumAm("2026-06-17", "24_wochen", "2026-01-01", GRENZEN)).toMatchObject({
      von: "2026-01-01",
      bis: "2026-06-17",
    });
    expect(zeitraumAm("2026-06-18", "24_wochen", "2026-01-01", GRENZEN)).toMatchObject({
      von: "2026-06-18",
      bis: "2026-12-02",
    });
    expect(zeitraumAm("2025-12-31", "24_wochen", "2026-01-01", GRENZEN)).toMatchObject({
      von: "2025-07-17",
      bis: "2025-12-31",
    });
  });

  it("lists the days of a period", () => {
    expect(tageVonBis("2026-02-27", "2026-03-01")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
    ]);
    expect(tageVonBis("2026-03-01", "2026-02-28")).toEqual([]);
  });
});

describe("limits per rule version", () => {
  it("has limits for every rule version, and none before the first", () => {
    for (const version of REGELVERSIONEN) expect(ARBZG_GRENZEN[version.wert]).toBeDefined();
    expect(arbzgGrenzenAm("2026-01-01")).toBe(GRENZEN);
    expect(arbzgGrenzenAm("2025-12-31")).toBeNull();
  });

  it("states the limits of §§ 3 to 5 ArbZG in whole minutes", () => {
    expect(GRENZEN).toMatchObject({
      werktaeglich: 480,
      verlaengert: 600,
      hintereinander: 360,
      ruhezeit: 660,
      ruhezeitVerkuerzt: 600,
      ruhezeitAusgleich: 720,
    });
    for (const wert of Object.values(GRENZEN))
      if (typeof wert === "number") expect(Number.isInteger(wert)).toBe(true);
  });
});
