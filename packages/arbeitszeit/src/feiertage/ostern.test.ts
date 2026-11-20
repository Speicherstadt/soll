import { describe, expect, it } from "vitest";
import { tagAus } from "../kalender/tag.ts";
import { ostersonntag } from "./ostern.ts";

/**
 * An independent method: the anonymous Gregorian algorithm (Meeus/Jones/Butcher, J. Meeus,
 * Astronomical Algorithms, 2nd ed., 1998, ch. 8), compared with Gauß/Lichtenberg for 1900 to 2100.
 */
const meeus = (jahr: number): string => {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return tagAus(jahr, monat, tag);
};

describe("ostersonntag", () => {
  it("matches the independent algorithm for 1900 to 2100", () => {
    for (let jahr = 1900; jahr <= 2100; jahr++)
      expect(ostersonntag(jahr), String(jahr)).toBe(meeus(jahr));
  });

  it("knows the years 2026 to 2035", () => {
    expect([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035].map(ostersonntag)).toEqual([
      "2026-04-05",
      "2027-03-28",
      "2028-04-16",
      "2029-04-01",
      "2030-04-21",
      "2031-04-13",
      "2032-03-28",
      "2033-04-17",
      "2034-04-09",
      "2035-03-25",
    ]);
  });

  it("handles Gauß's exceptions (1981 and 1954: limit on 25 and 26 April)", () => {
    expect(ostersonntag(1981)).toBe("1981-04-19");
    expect(ostersonntag(1954)).toBe("1954-04-18");
  });
});
