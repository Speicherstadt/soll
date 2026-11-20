import { describe, expect, it } from "vitest";
import { mutterschutzNacht } from "./nachtarbeit.ts";
import { LEA, MONTAG, mez, schicht, tage } from "./testhilfen.ts";
import type { MutterschutzOptionen } from "./typen.ts";

/* docs/regeln.md, R-21 (cases taken literally), § 5 Abs. 1 MuSchG, on Mo 16.11.2026 */
const pruefe = (von: string, bis: string, optionen: MutterschutzOptionen = LEA) =>
  mutterschutzNacht(tage(schicht(mez(MONTAG, von), mez(MONTAG, bis))), optionen).befunde;
const GENEHMIGT = { ...LEA, genehmigung28: { fundstelle: "Amt für Arbeitsschutz HH, 12/2026" } };

describe("R-21: keine Nachtarbeit", () => {
  it("Grenze: 12:00 – 20:00 – no finding", () => {
    expect(pruefe("12:00", "20:00")).toEqual([]);
  });

  it("Verstoß: 12:00 – 20:01 without a permit under § 28 – „nach 20 Uhr“", () => {
    expect(pruefe("12:00", "20:01")).toEqual([
      {
        regel: "R-21",
        norm: "§ 5 Abs. 1 Satz 1 MuSchG",
        schwere: "verstoss",
        art: "nachtarbeit",
        tage: [MONTAG],
        minuten: 1,
      },
    ]);
  });

  it("Genehmigung: 12:00 – 22:00 – no finding; 12:00 – 22:01 „nach 22 Uhr“", () => {
    expect(pruefe("12:00", "22:00", GENEHMIGT)).toEqual([]);
    expect(pruefe("12:00", "22:01", GENEHMIGT)).toEqual([
      expect.objectContaining({ norm: "§ 5 Abs. 1 Satz 2, § 28 MuSchG", minuten: 1 }),
    ]);
  });

  it("a permit for other days does not cover this evening", () => {
    const andere = {
      ...LEA,
      genehmigung28: { fundstelle: "HH 12/2026", tage: new Set(["2026-11-17"]) },
    };
    expect(pruefe("12:00", "22:00", andere)).toEqual([expect.objectContaining({ minuten: 120 })]);
  });

  it("no work before 6 Uhr either", () => {
    expect(pruefe("5:59", "12:00")).toEqual([expect.objectContaining({ minuten: 1 })]);
  });

  it("Herbst: Sa 24.10.2026 22:00 – So 6:00 – 9:00 in the night (real time)", () => {
    const stempel = schicht("2026-10-24T22:00+02:00", "2026-10-25T06:00+01:00");
    expect(mutterschutzNacht(tage(stempel), LEA).befunde).toEqual([
      expect.objectContaining({ tage: ["2026-10-24"], minuten: 9 * 60 }),
    ]);
  });
});
