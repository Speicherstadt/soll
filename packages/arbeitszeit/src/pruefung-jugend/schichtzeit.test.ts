import { describe, expect, it } from "vitest";
import { schichtzeit } from "./schichtzeit.ts";
import { CAFE, LEON, MONTAG, mez, schicht, tage } from "./testhilfen.ts";
import type { JugendOptionen } from "./typen.ts";

/* docs/regeln.md, R-17 (cases taken literally) on Mo 16.11.2026 */
const pruefe = (von: string, bis: string, optionen: JugendOptionen = LEON) =>
  schichtzeit(tage(schicht(mez(MONTAG, von), mez(MONTAG, bis))), optionen).befunde;

describe("R-17: Schichtzeit", () => {
  it("erlaubt: 7:00 – 16:00 (9:00) – no finding", () => {
    expect(pruefe("7:00", "16:00")).toEqual([]);
  });

  it("Grenze: 7:00 – 17:00 (10:00) – no finding", () => {
    expect(pruefe("7:00", "17:00")).toEqual([]);
  });

  it("Verstoß: 7:00 – 17:01 (10:01), no Montage – „Schichtzeit über 10 h“", () => {
    expect(pruefe("7:00", "17:01")).toEqual([
      {
        regel: "R-17",
        norm: "§ 12 JArbSchG",
        schwere: "verstoss",
        art: "schichtzeit",
        tage: [MONTAG],
        minuten: 601,
        grenze: 600,
        ueber: 1,
      },
    ]);
  });

  it("Montage: 7:00 – 18:00 (11:00) on a Montagestelle – no finding, 18:01 is one", () => {
    const montage = { ...LEON, montagetage: new Set([MONTAG]) };
    expect(pruefe("7:00", "18:00", montage)).toEqual([]);
    expect(pruefe("7:00", "18:01", montage)).toEqual([
      expect.objectContaining({ grenze: 660, ueber: 1 }),
    ]);
  });

  it("Gaststätte: Café, 10:00 – 21:01 (11:01) – „Schichtzeit über 11 h“", () => {
    expect(pruefe("10:00", "21:00", CAFE)).toEqual([]);
    expect(pruefe("10:00", "21:01", CAFE)).toEqual([
      expect.objectContaining({ minuten: 661, grenze: 660 }),
    ]);
  });

  it("Bergbau unter Tage: 8 hours", () => {
    expect(pruefe("7:00", "15:01", { ...LEON, branche: "bergbau_unter_tage" })).toEqual([
      expect.objectContaining({ grenze: 480, ueber: 1 }),
    ]);
  });

  it("zwei Schichten: Mo 6:00 – 9:00 and 18:00 – 20:00 – 14:00 from the first start to the last end", () => {
    const stempel = [
      ...schicht(mez(MONTAG, "6:00"), mez(MONTAG, "9:00")),
      ...schicht(mez(MONTAG, "18:00"), mez(MONTAG, "20:00")),
    ];
    expect(schichtzeit(tage(stempel), LEON).befunde).toEqual([
      expect.objectContaining({ minuten: 14 * 60, grenze: 600 }),
    ]);
  });
});
