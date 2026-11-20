import { describe, expect, it } from "vitest";
import { istTag, plusTage, tagAus, tageZwischen, wochentag } from "./tag.ts";
import { tagInBerlin } from "./zeit.ts";

describe("Tag", () => {
  it("writes a day with leading zeros", () => {
    expect(tagAus(2026, 1, 6)).toBe("2026-01-06");
  });

  it("counts across months, years and the leap day", () => {
    expect(plusTage("2028-02-28", 1)).toBe("2028-02-29");
    expect(plusTage("2026-12-31", 1)).toBe("2027-01-01");
    expect(plusTage("2026-04-05", -2)).toBe("2026-04-03");
  });

  it("counts the days between two days, also over the leap day and backwards", () => {
    expect(tageZwischen("2026-01-01", "2026-01-01")).toBe(0);
    expect(tageZwischen("2028-02-28", "2028-03-01")).toBe(2);
    expect(tageZwischen("2026-03-28", "2026-03-30")).toBe(2);
    expect(tageZwischen("2026-01-02", "2026-01-01")).toBe(-1);
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

describe("istTag", () => {
  it("takes real days only", () => {
    expect(istTag("2028-02-29")).toBe(true);
    expect(istTag("2026-02-29")).toBe(false);
    expect(istTag("2026-13-40")).toBe(false);
    expect(istTag("2026-1-5")).toBe(false);
    expect(istTag("heute")).toBe(false);
  });
});

describe("years below 100", () => {
  // Date.UTC maps the years 0 to 99 onto 1900 to 1999; a four-digit day must stay in its own year
  it("keeps the year", () => {
    expect(tagAus(99, 12, 31)).toBe("0099-12-31");
    expect(plusTage("0100-01-01", -1)).toBe("0099-12-31");
    expect(wochentag("0099-12-31")).toBe(4);
  });

  it("takes a real day of such a year", () => {
    expect(istTag("0099-12-31")).toBe(true);
  });
});

describe("tagInBerlin", () => {
  it("is the calendar day in Europe/Berlin, not in UTC", () => {
    // 23:30 UTC on 30 June is 01:30 CEST on 1 July
    expect(tagInBerlin(Date.UTC(2026, 5, 30, 23, 30))).toBe("2026-07-01");
    // 23:30 UTC on 30 January is 00:30 CET on 31 January
    expect(tagInBerlin(Date.UTC(2026, 0, 30, 23, 30))).toBe("2026-01-31");
    expect(tagInBerlin(Date.UTC(2026, 0, 30, 22, 59))).toBe("2026-01-30");
  });

  it("follows the change of time: 22:30 UTC is the next day in summer, the same day in winter", () => {
    // 28 March 2027 is the last Sunday of March: from 01:00 UTC Berlin is UTC+2
    expect(tagInBerlin(Date.UTC(2027, 2, 27, 22, 30))).toBe("2027-03-27");
    expect(tagInBerlin(Date.UTC(2027, 2, 28, 22, 30))).toBe("2027-03-29");
    // 25 October 2026: from 01:00 UTC Berlin is UTC+1 again
    expect(tagInBerlin(Date.UTC(2026, 9, 24, 22, 30))).toBe("2026-10-25");
    expect(tagInBerlin(Date.UTC(2026, 9, 25, 22, 30))).toBe("2026-10-25");
  });
});
