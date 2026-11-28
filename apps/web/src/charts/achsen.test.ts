import { describe, expect, it } from "vitest";
import { saldoAchseText, stundenAchseText } from "./achsen.ts";

describe("chart duration axis labels (DESIGN.md: H:MM, never decimals)", () => {
  it("formats non-negative hour axis ticks as H:MM without decimal dots", () => {
    expect(stundenAchseText(0)).toBe("0:00");
    expect(stundenAchseText(2.5)).toBe("2:30");
    expect(stundenAchseText(7.5)).toBe("7:30");
    expect(stundenAchseText(10)).toBe("10:00");
  });

  it("formats signed balance axis ticks as +H:MM / -H:MM and 0:00 at zero", () => {
    expect(saldoAchseText(0)).toBe("0:00");
    expect(saldoAchseText(2.5)).toBe("+2:30");
    expect(saldoAchseText(-2.5)).toBe("-2:30");
    expect(saldoAchseText(-10)).toBe("-10:00");
  });
});
