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

  it("refuses unknown roles", () => {
    expect(darf("owner", "betrieb:lesen")).toBe(false);
  });
});
