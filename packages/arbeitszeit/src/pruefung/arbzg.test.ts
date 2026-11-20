import { describe, expect, it } from "vitest";
import { arbzgBefunde } from "./arbzg.ts";
import { arbeit, schicht, tage, um } from "./testhilfen.ts";

/*
 * The checks of §§ 3 to 5 ArbZG together, on Max's week at Weber Haustechnik (test data of
 * CLAUDE.md): one long day without a break, then an early start.
 */
describe("§§ 3 to 5 ArbZG together", () => {
  it("gives the findings of R-02 to R-05 in calendar order of their first day", () => {
    const jetzt = um("2026-11-20T12:00+01:00");
    const stempel = [
      ...arbeit("2026-11-16T06:00+01:00", 661), // Mo 6:00 to 17:01 without a break
      ...schicht("2026-11-17T03:00+01:00", "2026-11-17T09:00+01:00"),
    ];
    const ergebnis = arbzgBefunde(tage(stempel, jetzt), {
      jetzt,
      feiertage: new Set(),
      neutral: new Set(),
    });
    expect(ergebnis.nichtHinterlegt).toEqual([]);
    expect(ergebnis.befunde.map((befund) => [befund.regel, befund.art, befund.tage])).toEqual([
      ["R-02", "ueber_10h", ["2026-11-16"]],
      ["R-04", "pause_fehlt", ["2026-11-16"]],
      ["R-04", "ohne_pause", ["2026-11-16"]],
      ["R-05", "ruhezeit_zu_kurz", ["2026-11-16", "2026-11-17"]],
    ]);
  });

  it("names every day no rule version covers once", () => {
    const jetzt = um("2026-01-02T12:00+01:00");
    const stempel = [
      ...arbeit("2025-12-30T08:00+01:00", 400),
      ...arbeit("2025-12-31T08:00+01:00", 400),
    ];
    const ergebnis = arbzgBefunde(tage(stempel, jetzt), {
      jetzt,
      feiertage: new Set(),
      neutral: new Set(),
    });
    expect(ergebnis).toEqual({ befunde: [], nichtHinterlegt: ["2025-12-30", "2025-12-31"] });
  });
});
