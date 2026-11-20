import { describe, expect, it } from "vitest";
import { ersterTag, istMonat, letzterTag, monatVon, plusMonate } from "./monat.ts";

describe("Monat", () => {
  it("accepts real months only", () => {
    expect(istMonat("2026-11")).toBe(true);
    expect(istMonat("2026-13")).toBe(false);
    expect(istMonat("2026-00")).toBe(false);
    expect(istMonat("2026-1")).toBe(false);
    expect(istMonat("2026-11-01")).toBe(false);
  });

  it("steps over the turn of the year both ways", () => {
    expect(plusMonate("2026-12", 1)).toBe("2027-01");
    expect(plusMonate("2026-11", -11)).toBe("2025-12");
    expect(plusMonate("2026-01", -1)).toBe("2025-12");
  });

  it("knows its first and last day, February in a leap year included", () => {
    expect(ersterTag("2026-11")).toBe("2026-11-01");
    expect(letzterTag("2026-11")).toBe("2026-11-30");
    expect(letzterTag("2028-02")).toBe("2028-02-29");
    expect(letzterTag("2026-12")).toBe("2026-12-31");
    expect(monatVon("2026-12-31")).toBe("2026-12");
  });
});
