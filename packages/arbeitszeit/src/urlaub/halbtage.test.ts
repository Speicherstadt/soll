import { describe, expect, it } from "vitest";
import { halbtageAufgerundet } from "./halbtage.ts";

/** Days as a fraction: `tage` = zaehler / nenner days, given to the function as half days */
const tage = (zaehler: number, nenner: number) => halbtageAufgerundet(2 * zaehler, nenner);

describe("Rundung nach § 5 Abs. 2 BUrlG, in halben Tagen", () => {
  it("keeps whole days", () => {
    expect(tage(20, 1)).toBe(40);
    expect(tage(240, 12)).toBe(40);
  });

  it("rounds a fraction of at least half a day up to a full day", () => {
    // docs/regeln.md, R-23 Rundung: 4 × 20 ÷ 12 = 6,67 → 7; R-25 anteilig: 2,5 → 3
    expect(tage(80, 12)).toBe(14);
    expect(tage(30, 12)).toBe(6);
    expect(tage(1, 2)).toBe(2);
  });

  it("never rounds a smaller fraction down: it becomes a half day", () => {
    // docs/regeln.md, R-23 Teilurlaub: 5 × 20 ÷ 12 = 8,33 → 8,5 (BAG, 26.01.1989, 8 AZR 730/87)
    expect(tage(100, 12)).toBe(17);
    expect(tage(1, 365)).toBe(1);
  });

  it("decides the boundary exactly, without floats", () => {
    expect(tage(499_999, 1_000_000)).toBe(1);
    expect(tage(500_000, 1_000_000)).toBe(2);
    expect(tage(0, 7)).toBe(0);
  });
});
