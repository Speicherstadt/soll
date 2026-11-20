import { describe, expect, it } from "vitest";
import { mutterschutzBefunde } from "./mutterschutz.ts";
import { LEA, tagAb } from "./testhilfen.ts";

describe("mutterschutzBefunde", () => {
  it("collects §§ 3 to 6 MuSchG in calendar order of their first day", () => {
    // Mo 16.11.2026 12:00 – 21:31 (9:31), Di from 6:00; So 22.11. 10:00 – 12:00
    const tage = [
      tagAb("2026-11-16", "12:00", 9 * 60 + 31),
      tagAb("2026-11-17", "6:00", 4 * 60),
      tagAb("2026-11-22", "10:00", 120),
    ];
    const ergebnis = mutterschutzBefunde(tage, { ...LEA, wochenarbeitszeitAm: () => 40 * 60 });
    expect(ergebnis.befunde.map((befund) => [befund.art, befund.tage[0]])).toEqual([
      ["ueber_8_30", "2026-11-16"],
      ["ruhezeit_zu_kurz", "2026-11-16"],
      ["nachtarbeit", "2026-11-16"],
      ["sonntagsarbeit", "2026-11-22"],
    ]);
    expect(ergebnis.nichtHinterlegt).toEqual([]);
  });

  it("judges nothing outside the span of the mark but a Schutzfrist entered", () => {
    const ohne = { ...LEA, zeitraeume: [] };
    expect(mutterschutzBefunde([tagAb("2026-11-16", "12:00", 600)], ohne)).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
    const frist = { art: "nach_entbindung" as const, von: "2026-11-03", bis: "2026-12-28" };
    expect(
      mutterschutzBefunde([tagAb("2026-11-16", "8:00", 60)], { ...ohne, schutzfristen: [frist] })
        .befunde,
    ).toEqual([expect.objectContaining({ art: "schutzfrist" })]);
  });
});
