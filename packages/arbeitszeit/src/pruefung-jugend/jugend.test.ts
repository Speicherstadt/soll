import { describe, expect, it } from "vitest";
import { jugendBefunde } from "./jugend.ts";
import { LEON, MONTAG, tagAb, woche } from "./testhilfen.ts";

describe("jugendBefunde", () => {
  it("collects R-15 to R-20 in calendar order of their first day, rule by rule within a day", () => {
    // Mo 7:00 – 18:00 without a break (11:00), Sa 7:00 – 12:00
    const tage = [tagAb(MONTAG, "7:00", 11 * 60), tagAb("2026-11-21", "7:00", 5 * 60)];
    const ergebnis = jugendBefunde(tage, LEON);
    expect(ergebnis.befunde.map((befund) => [befund.regel, befund.art, befund.tage[0]])).toEqual([
      ["R-15", "ueber_8_30", MONTAG],
      ["R-16", "pause_fehlt", MONTAG],
      ["R-16", "ohne_pause", MONTAG],
      ["R-17", "schichtzeit", MONTAG],
      ["R-16", "pause_fehlt", "2026-11-21"],
      ["R-16", "ohne_pause", "2026-11-21"],
      ["R-20", "samstag", "2026-11-21"],
    ]);
    expect(ergebnis.nichtHinterlegt).toEqual([]);
  });

  it("judges nothing for an adult and names days before 2026 as nicht hinterlegt", () => {
    expect(
      jugendBefunde(woche(MONTAG, ["11:00"]), { ...LEON, geburtsdatum: "2000-01-01" }),
    ).toEqual({ befunde: [], nichtHinterlegt: [] });
    expect(jugendBefunde(woche("2025-12-01", ["8:00"]), LEON).nichtHinterlegt).toEqual([
      "2025-12-01",
    ]);
  });
});
