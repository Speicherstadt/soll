import { describe, expect, it } from "vitest";
import { plusTage, tagAus, wochentag } from "./tag.ts";

describe("Tag", () => {
  it("writes a day with leading zeros", () => {
    expect(tagAus(2026, 1, 6)).toBe("2026-01-06");
  });

  it("counts across months, years and the leap day", () => {
    expect(plusTage("2028-02-28", 1)).toBe("2028-02-29");
    expect(plusTage("2026-12-31", 1)).toBe("2027-01-01");
    expect(plusTage("2026-04-05", -2)).toBe("2026-04-03");
  });

  it("is not shifted by the change to summer time", () => {
    expect(plusTage("2026-03-28", 1)).toBe("2026-03-29");
    expect(plusTage("2026-03-29", 1)).toBe("2026-03-30");
  });

  it("knows the weekday", () => {
    expect(wochentag("2026-11-20")).toBe(5);
    expect(wochentag("2026-04-05")).toBe(0);
  });
});
