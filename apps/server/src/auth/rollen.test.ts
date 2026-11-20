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

  it("refuses unknown roles", () => {
    expect(darf("owner", "betrieb:lesen")).toBe(false);
  });
});
