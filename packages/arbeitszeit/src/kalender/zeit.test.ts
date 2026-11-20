import { describe, expect, it } from "vitest";
import { beginnInBerlin, tagInBerlin } from "./zeit.ts";

const utc = (text: string) => Date.parse(text);

describe("days in Europe/Berlin", () => {
  it("names the Berlin day of an instant, also across midnight in winter and summer", () => {
    expect(tagInBerlin(utc("2026-12-31T22:59:59.999Z"))).toBe("2026-12-31");
    expect(tagInBerlin(utc("2026-12-31T23:00:00Z"))).toBe("2027-01-01");
    expect(tagInBerlin(utc("2026-06-30T21:59:59.999Z"))).toBe("2026-06-30");
    expect(tagInBerlin(utc("2026-06-30T22:00:00Z"))).toBe("2026-07-01");
  });

  it("finds midnight in Berlin, with CET in winter and CEST in summer", () => {
    expect(beginnInBerlin("2027-01-01")).toBe(utc("2026-12-31T23:00:00Z"));
    expect(beginnInBerlin("2026-07-01")).toBe(utc("2026-06-30T22:00:00Z"));
    // the days of the DST changes begin at midnight, before the change at 2:00 or 3:00
    expect(beginnInBerlin("2026-03-29")).toBe(utc("2026-03-28T23:00:00Z"));
    expect(beginnInBerlin("2026-10-25")).toBe(utc("2026-10-24T22:00:00Z"));
    expect(beginnInBerlin("2026-10-26")).toBe(utc("2026-10-25T23:00:00Z"));
  });
});
