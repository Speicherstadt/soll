import { describe, expect, it } from "vitest";
import { darf } from "./rollen.ts";

describe("darf", () => {
  it("lets the owner switch modules and nobody else", () => {
    expect(darf("inhaber", "betrieb:module")).toBe(true);
    for (const rolle of ["planer", "mitarbeiter", "lohnbuero", "betriebsrat", "extern", "geraet"]) {
      expect(darf(rolle, "betrieb:module"), rolle).toBe(false);
    }
  });

  it("lets a device check PINs and read nothing", () => {
    expect(darf("geraet", "pin:pruefen")).toBe(true);
    expect(darf("geraet", "betrieb:lesen")).toBe(false);
  });

  it("lets the owner set up the business and nobody else", () => {
    expect(darf("inhaber", "betrieb:einrichten")).toBe(true);
    for (const rolle of ["planer", "mitarbeiter", "lohnbuero", "betriebsrat", "extern", "geraet"]) {
      expect(darf(rolle, "betrieb:einrichten"), rolle).toBe(false);
    }
  });

  it("shows the wages of working-time models to the owner and payroll only", () => {
    for (const rolle of ["inhaber", "lohnbuero"])
      expect(darf(rolle, "modelle:lesen"), rolle).toBe(true);
    for (const rolle of ["planer", "mitarbeiter", "betriebsrat", "extern", "geraet"]) {
      expect(darf(rolle, "modelle:lesen"), rolle).toBe(false);
    }
  });

  it("lets everyone who works for the business stamp, but no external staff and no device", () => {
    for (const rolle of ["inhaber", "planer", "mitarbeiter", "lohnbuero", "betriebsrat"])
      expect(darf(rolle, "stempeln"), rolle).toBe(true);
    for (const rolle of ["extern", "geraet"]) expect(darf(rolle, "stempeln"), rolle).toBe(false);
  });

  it("lets owner and planner correct others' times, and payroll read them", () => {
    for (const rolle of ["inhaber", "planer"])
      expect(darf(rolle, "zeiten:korrigieren"), rolle).toBe(true);
    for (const rolle of ["mitarbeiter", "lohnbuero", "betriebsrat", "extern", "geraet"])
      expect(darf(rolle, "zeiten:korrigieren"), rolle).toBe(false);
    for (const rolle of ["inhaber", "planer", "lohnbuero"])
      expect(darf(rolle, "zeiten:alle"), rolle).toBe(true);
    for (const rolle of ["mitarbeiter", "betriebsrat", "extern", "geraet"])
      expect(darf(rolle, "zeiten:alle"), rolle).toBe(false);
  });

  it("lets owner and planner keep customers, orders and rates, and everyone but a device read orders", () => {
    for (const rolle of ["inhaber", "planer"])
      expect(darf(rolle, "projekte:verwalten"), rolle).toBe(true);
    for (const rolle of ["mitarbeiter", "lohnbuero", "betriebsrat", "extern", "geraet"])
      expect(darf(rolle, "projekte:verwalten"), rolle).toBe(false);
    for (const rolle of ["inhaber", "planer", "mitarbeiter", "lohnbuero", "betriebsrat", "extern"])
      expect(darf(rolle, "projekte:lesen"), rolle).toBe(true);
    expect(darf("geraet", "projekte:lesen")).toBe(false);
  });

  it("lets owner and planner plan, and everyone who works for the business read the plan", () => {
    for (const rolle of ["inhaber", "planer"]) expect(darf(rolle, "plan:planen"), rolle).toBe(true);
    for (const rolle of ["mitarbeiter", "lohnbuero", "betriebsrat", "extern", "geraet"])
      expect(darf(rolle, "plan:planen"), rolle).toBe(false);
    for (const rolle of ["inhaber", "planer", "mitarbeiter", "lohnbuero", "betriebsrat"])
      expect(darf(rolle, "plan:lesen"), rolle).toBe(true);
    for (const rolle of ["extern", "geraet"]) expect(darf(rolle, "plan:lesen"), rolle).toBe(false);
  });

  it("lets only the owner give the Auskunft of another person (Art. 15 DSGVO)", () => {
    expect(darf("inhaber", "auskunft:erteilen")).toBe(true);
    for (const rolle of ["planer", "mitarbeiter", "lohnbuero", "betriebsrat", "extern", "geraet"])
      expect(darf(rolle, "auskunft:erteilen"), rolle).toBe(false);
  });

  it("refuses unknown roles", () => {
    expect(darf("owner", "betrieb:lesen")).toBe(false);
  });
});
