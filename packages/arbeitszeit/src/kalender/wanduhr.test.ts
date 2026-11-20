import { describe, expect, it } from "vitest";
import { minuteInBerlin, zeitpunktInBerlin } from "./wanduhr.ts";

const utc = (text: string) => Date.parse(text);

describe("Berlin wall-clock times", () => {
  it("finds the instant of a wall-clock time in winter and in summer", () => {
    expect(zeitpunktInBerlin("2026-11-20", 8 * 60)).toBe(utc("2026-11-20T07:00:00Z"));
    expect(zeitpunktInBerlin("2026-07-01", 8 * 60)).toBe(utc("2026-07-01T06:00:00Z"));
    expect(zeitpunktInBerlin("2026-11-20", 0)).toBe(utc("2026-11-19T23:00:00Z"));
    expect(zeitpunktInBerlin("2026-11-20", 23 * 60 + 59)).toBe(utc("2026-11-20T22:59:00Z"));
  });

  it("has no instant for a time the clocks skip in spring (SoZV: 2:00 to 3:00)", () => {
    expect(zeitpunktInBerlin("2027-03-28", 2 * 60 + 30)).toBeNull();
    expect(zeitpunktInBerlin("2027-03-28", 3 * 60)).toBe(utc("2027-03-28T01:00:00Z"));
    expect(zeitpunktInBerlin("2027-03-28", 60 + 59)).toBe(utc("2027-03-28T00:59:00Z"));
  });

  it("takes the first of the two instants of the hour that comes twice in October", () => {
    // SoZV: on 25.10.2026 the clocks go back from 3:00 summer time to 2:00 winter time
    expect(zeitpunktInBerlin("2026-10-25", 2 * 60 + 30)).toBe(utc("2026-10-25T00:30:00Z"));
    expect(zeitpunktInBerlin("2026-10-25", 3 * 60)).toBe(utc("2026-10-25T02:00:00Z"));
  });

  it("refuses a minute outside the day and a day that is none", () => {
    expect(zeitpunktInBerlin("2026-11-20", -1)).toBeNull();
    expect(zeitpunktInBerlin("2026-11-20", 24 * 60)).toBeNull();
    expect(zeitpunktInBerlin("2026-11-20", 1.5)).toBeNull();
    expect(zeitpunktInBerlin("2026-02-30", 60)).toBeNull();
  });

  it("names the minute of the day an instant shows on a Berlin clock, seconds cut off", () => {
    expect(minuteInBerlin(utc("2026-11-20T07:00:59Z"))).toBe(8 * 60);
    expect(minuteInBerlin(utc("2026-07-01T06:00:00Z"))).toBe(8 * 60);
    expect(minuteInBerlin(utc("2026-10-25T00:30:00Z"))).toBe(2 * 60 + 30);
    expect(minuteInBerlin(utc("2026-10-25T01:30:00Z"))).toBe(2 * 60 + 30);
  });

  it("goes there and back for every minute of a day of each kind", () => {
    for (const tag of ["2026-11-20", "2026-07-01", "2027-03-28", "2026-10-25"]) {
      for (let minute = 0; minute < 24 * 60; minute += 1) {
        const zeitpunkt = zeitpunktInBerlin(tag, minute);
        if (zeitpunkt !== null) expect(minuteInBerlin(zeitpunkt)).toBe(minute);
      }
    }
  });
});
