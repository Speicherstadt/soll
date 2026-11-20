import { describe, expect, it } from "vitest";
import { monatsfristEnde, volleMonate } from "./fristen.ts";

describe("Monatsfristen nach §§ 187, 188 BGB", () => {
  it("ends the day before the day of the same number (§ 188 Abs. 2 BGB)", () => {
    expect(monatsfristEnde("2026-08-01", 5)).toBe("2026-12-31");
    expect(monatsfristEnde("2026-06-01", 6)).toBe("2026-11-30");
    expect(monatsfristEnde("2026-07-02", 6)).toBe("2027-01-01");
    expect(monatsfristEnde("2026-08-15", 1)).toBe("2026-09-14");
  });

  it("ends on the last day of a month without that day (§ 188 Abs. 3 BGB), leap years included", () => {
    expect(monatsfristEnde("2026-01-31", 1)).toBe("2026-02-28");
    expect(monatsfristEnde("2028-01-31", 1)).toBe("2028-02-29");
    expect(monatsfristEnde("2026-01-30", 1)).toBe("2026-02-28");
    expect(monatsfristEnde("2028-01-29", 1)).toBe("2028-02-28");
    expect(monatsfristEnde("2026-08-31", 1)).toBe("2026-09-30");
  });

  it("counts the full months between two days, both included", () => {
    expect(volleMonate("2026-08-01", "2026-12-31")).toBe(5);
    expect(volleMonate("2026-08-01", "2026-12-30")).toBe(4);
    expect(volleMonate("2026-01-01", "2026-04-30")).toBe(4);
    expect(volleMonate("2026-08-15", "2026-12-31")).toBe(4);
    expect(volleMonate("2026-08-31", "2026-12-31")).toBe(4);
    expect(volleMonate("2026-01-01", "2026-12-31")).toBe(12);
    expect(volleMonate("2026-05-10", "2026-05-01")).toBe(0);
    expect(volleMonate("2026-05-01", "2026-05-01")).toBe(0);
  });
});
