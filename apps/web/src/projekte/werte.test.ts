import { describe, expect, it } from "vitest";
import { budgetMinutenAus } from "./werte.ts";

describe("budgetMinutenAus", () => {
  it("reads whole hours and hours with minutes, beyond a week", () => {
    expect(budgetMinutenAus("40")).toBe(2_400);
    expect(budgetMinutenAus(" 12:30 ")).toBe(750);
    expect(budgetMinutenAus("400")).toBe(24_000);
    expect(budgetMinutenAus("0:01")).toBe(1);
  });

  it("refuses fractions, minutes past 59, zero and text", () => {
    for (const text of ["38,5", "38.5", "1:60", "0", "0:00", "", "vierzig", "-5", "1234567"])
      expect(budgetMinutenAus(text), text).toBeNull();
  });
});
