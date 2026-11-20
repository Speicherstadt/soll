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

  it("writes a day as YYYY-MM-DD also in a year below 1000, like tag.ts does", () => {
    expect(tagInBerlin(utc("0999-06-01T12:00:00Z"))).toBe("0999-06-01");
  });

  it("finds midnight on every day istTag accepts, also when Berlin was not one or two hours ahead", () => {
    // 1947: Hochsommerzeit, UTC+3 from 11 May to 29 June (tz database, Europe/Berlin)
    expect(beginnInBerlin("1947-06-01")).toBe(utc("1947-05-31T21:00:00Z"));
    // before 1 April 1893 Berlin kept its local mean time, UTC+0:53:28
    expect(beginnInBerlin("1892-01-01")).toBe(utc("1891-12-31T23:06:32Z"));
  });

  it("takes the first of two midnights when the clocks went back at 1:00, as on 1 October 1916", () => {
    // tz database, Rule C-Eur 1916: Oct 1 1:00 back to CET, so 0:00 to 1:00 came twice
    expect(beginnInBerlin("1916-10-01")).toBe(utc("1916-09-30T22:00:00Z"));
  });

  it("names and finds the days of the year 0, which istTag accepts", () => {
    // Intl writes the year 0 as 1 BC; the day must still read 0000 (ISO 8601, proleptic Gregorian)
    expect(tagInBerlin(utc("0000-06-01T12:00:00Z"))).toBe("0000-06-01");
    expect(tagInBerlin(beginnInBerlin("0000-06-01"))).toBe("0000-06-01");
  });
});
