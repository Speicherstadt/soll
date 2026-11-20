import { describe, expect, it } from "vitest";
import { kalenderwoche, planWoche } from "./woche.ts";

describe("planWoche", () => {
  it("runs Monday to Sunday around any of its days", () => {
    const woche = planWoche("2026-11-26");
    expect(woche.tage).toEqual([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
    ]);
    expect(woche.kw).toEqual({ jahr: 2026, nummer: 48 });
  });

  it("keeps seven days in the weeks the clocks change", () => {
    expect(planWoche("2026-03-29").tage).toHaveLength(7);
    expect(planWoche("2026-03-29").tage[0]).toBe("2026-03-23");
    expect(planWoche("2026-10-25").tage.at(-1)).toBe("2026-10-25");
  });
});

describe("kalenderwoche (ISO 8601)", () => {
  it("counts the week with the year's first Thursday as week 1", () => {
    expect(kalenderwoche("2026-01-01")).toEqual({ jahr: 2026, nummer: 1 });
    expect(kalenderwoche("2027-01-01")).toEqual({ jahr: 2026, nummer: 53 });
    expect(kalenderwoche("2027-01-04")).toEqual({ jahr: 2027, nummer: 1 });
    expect(kalenderwoche("2024-12-30")).toEqual({ jahr: 2025, nummer: 1 });
    expect(kalenderwoche("2026-12-28")).toEqual({ jahr: 2026, nummer: 53 });
  });
});
