import { describe, expect, it } from "vitest";
import { monatsdurchschnitt } from "./monat.ts";
import { LEA, tagAb } from "./testhilfen.ts";

/* docs/regeln.md, R-21 „Monat“ (case taken literally), § 4 Abs. 1 Satz 4 MuSchG */
const ZWANZIG = { ...LEA, wochenarbeitszeitAm: () => 20 * 60 };

/** November 2026: `minuten` spread over two days */
const november = (minuten: number) => [
  tagAb("2026-11-03", "8:00", 300),
  tagAb("2026-11-04", "8:00", minuten - 300),
];

describe("R-21: vertragliche Wochenarbeitszeit im Monatsdurchschnitt", () => {
  it("Monat: 20:00 a week, November 2026 (30 days) with 85:42 – no finding", () => {
    expect(monatsdurchschnitt(november(85 * 60 + 42), ZWANZIG)).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });

  it("Monat: with 85:43 – „über der vertraglichen Arbeitszeit“", () => {
    expect(monatsdurchschnitt(november(85 * 60 + 43), ZWANZIG).befunde).toEqual([
      {
        regel: "R-21",
        norm: "§ 4 Abs. 1 Satz 4 MuSchG",
        schwere: "verstoss",
        art: "ueber_vertrag",
        tage: ["2026-11-03", "2026-11-04"],
        monat: "2026-11",
        minuten: 85 * 60 + 43,
        erlaubt: 85 * 60 + 42,
        ueber: 1,
      },
    ]);
  });

  it("follows a change of the contractual time within the month, a seventh per day", () => {
    // 20 h until 15.11., 30 h from 16.11.: (15 × 20 + 15 × 30) ÷ 7 = 107:08 and 4/7
    const wechsel = {
      ...LEA,
      wochenarbeitszeitAm: (tag: string) => (tag < "2026-11-16" ? 1200 : 1800),
    };
    expect(monatsdurchschnitt(november(107 * 60 + 8), wechsel).befunde).toEqual([]);
    expect(monatsdurchschnitt(november(107 * 60 + 9), wechsel).befunde).toHaveLength(1);
  });

  it("counts only the days of the month in a span of the mark", () => {
    // from 16.11.: 15 days, 20 × 15 ÷ 7 = 42:51 and 3/7
    const ab = { ...ZWANZIG, zeitraeume: [{ von: "2026-11-16", bis: null }] };
    const tage = [tagAb("2026-11-03", "8:00", 600), tagAb("2026-11-17", "8:00", 42 * 60 + 51)];
    expect(monatsdurchschnitt(tage, ab).befunde).toEqual([]);
    const mehr = [tagAb("2026-11-17", "8:00", 42 * 60 + 52)];
    expect(monatsdurchschnitt(mehr, ab).befunde).toHaveLength(1);
  });

  it("is nicht hinterlegt without the contractual weekly time", () => {
    expect(monatsdurchschnitt(november(600), LEA)).toEqual({
      befunde: [],
      nichtHinterlegt: ["2026-11-03", "2026-11-04"],
    });
    const luecke = {
      ...LEA,
      wochenarbeitszeitAm: (tag: string) => (tag === "2026-11-30" ? null : 1200),
    };
    expect(monatsdurchschnitt(november(600), luecke).nichtHinterlegt).toHaveLength(2);
  });
});
