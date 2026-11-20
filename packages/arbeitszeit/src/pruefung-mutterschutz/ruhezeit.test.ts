import { describe, expect, it } from "vitest";
import { mutterschutzRuhezeit } from "./ruhezeit.ts";
import { LEA, mez, schicht, tage } from "./testhilfen.ts";

/* docs/regeln.md, R-21 „Ruhezeit“ (case taken literally), § 4 Abs. 2 MuSchG */
const moDi = (ende: string, beginn: string) =>
  tage([
    ...schicht(mez("2026-11-16", "12:00"), mez("2026-11-16", ende)),
    ...schicht(mez("2026-11-17", beginn), mez("2026-11-17", "12:00")),
  ]);

describe("R-21: Ruhezeit", () => {
  it("Mo 19:00 – Di 6:00 (11:00) – no finding", () => {
    expect(mutterschutzRuhezeit(moDi("19:00", "6:00"), LEA)).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });

  it("Mo 19:30 – Di 6:29 (10:59) – „Ruhezeit 10:59“", () => {
    expect(mutterschutzRuhezeit(moDi("19:30", "6:29"), LEA).befunde).toEqual([
      {
        regel: "R-21",
        norm: "§ 4 Abs. 2 MuSchG",
        schwere: "verstoss",
        art: "ruhezeit_zu_kurz",
        tage: ["2026-11-16", "2026-11-17"],
        ruhe: {
          beginn: Date.parse(mez("2026-11-16", "19:30")),
          ende: Date.parse(mez("2026-11-17", "6:29")),
          minuten: 659,
        },
        mindestens: 660,
        fehlt: 1,
      },
    ]);
  });

  it("is never shortened, not even in the Gastronomie (§ 5 Abs. 2 ArbZG does not apply)", () => {
    expect(mutterschutzRuhezeit(moDi("20:00", "6:00"), LEA).befunde).toEqual([
      expect.objectContaining({ fehlt: 60 }),
    ]);
  });

  it("applies when either day lies in the span of the mark", () => {
    const bisMontag = { ...LEA, zeitraeume: [{ von: "2026-01-01", bis: "2026-11-16" }] };
    expect(mutterschutzRuhezeit(moDi("19:30", "6:29"), bisMontag).befunde).toHaveLength(1);
    const ohne = { ...LEA, zeitraeume: [{ von: "2026-11-18", bis: null }] };
    expect(mutterschutzRuhezeit(moDi("19:30", "6:29"), ohne).befunde).toEqual([]);
  });

  it("am selben Tag: Mo 0:00 – 4:00, Mo 14:00 – 18:00 (10:00) – „Ruhezeit 10:00“", () => {
    // two shifts 10 hours apart are two working days by the 9 hours of S-201, measured as in R-05
    const zweiSchichten = tage([
      ...schicht(mez("2026-11-16", "0:00"), mez("2026-11-16", "4:00")),
      ...schicht(mez("2026-11-16", "14:00"), mez("2026-11-16", "18:00")),
    ]);
    expect(mutterschutzRuhezeit(zweiSchichten, LEA).befunde).toEqual([
      expect.objectContaining({ fehlt: 60, ruhe: expect.objectContaining({ minuten: 600 }) }),
    ]);
  });
});
