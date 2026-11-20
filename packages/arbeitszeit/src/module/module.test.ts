import { describe, expect, it } from "vitest";
import { fragenAusModulen, MODULE, moduleAusFragen } from "./module.ts";

describe("the four questions of the setup", () => {
  it("a freelancer without employees gets project time only, whatever else is answered", () => {
    expect(
      moduleAusFragen({ beschaeftigte: false, schichten: true, kunden: false, stempelort: true }),
    ).toEqual({ arbeitszeit: false, dienstplan: false, projektzeit: true, terminal: false });
  });

  it("a café with employees in shifts gets working time and the rota", () => {
    expect(
      moduleAusFragen({ beschaeftigte: true, schichten: true, kunden: false, stempelort: false }),
    ).toEqual({ arbeitszeit: true, dienstplan: true, projektzeit: false, terminal: false });
  });

  it("an SHK business billing customers with a fixed place to clock in", () => {
    expect(
      moduleAusFragen({ beschaeftigte: true, schichten: false, kunden: true, stempelort: true }),
    ).toEqual({ arbeitszeit: true, dienstplan: false, projektzeit: true, terminal: true });
  });

  it("employees always bring working time, which the setup cannot switch off (BAG 1 ABR 22/21)", () => {
    for (const schichten of [true, false])
      for (const kunden of [true, false])
        for (const stempelort of [true, false])
          expect(
            moduleAusFragen({ beschaeftigte: true, schichten, kunden, stempelort }).arbeitszeit,
          ).toBe(true);
  });

  it("the answers come back from the modules, so a resumed setup shows what was chosen", () => {
    for (const beschaeftigte of [true, false])
      for (const schichten of [true, false])
        for (const kunden of [true, false])
          for (const stempelort of [true, false]) {
            const fragen = { beschaeftigte, schichten, kunden, stempelort };
            const zurueck = fragenAusModulen(moduleAusFragen(fragen));
            expect(moduleAusFragen(zurueck)).toEqual(moduleAusFragen(fragen));
          }
  });

  it("knows the four modules in the order of docs/plan.md", () => {
    expect(MODULE).toEqual(["arbeitszeit", "dienstplan", "projektzeit", "terminal"]);
  });
});
