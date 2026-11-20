import { describe, expect, it } from "vitest";
import { schichtMinuten, schichtZeiten, uhrzeitenVon, verschoben } from "./zeiten.ts";

const STUNDE = 3_600_000;

describe("schichtZeiten", () => {
  it("places a day shift on the Berlin clock of its day", () => {
    const zeiten = schichtZeiten("2026-11-23", 7 * 60, 15 * 60);
    expect(zeiten).toEqual({
      beginn: Date.parse("2026-11-23T06:00:00Z"),
      ende: Date.parse("2026-11-23T14:00:00Z"),
    });
  });

  it("ends a shift over midnight on the next day; it belongs to the day it begins on", () => {
    const zeiten = schichtZeiten("2026-11-27", 22 * 60, 6 * 60);
    expect(zeiten).toEqual({
      beginn: Date.parse("2026-11-27T21:00:00Z"),
      ende: Date.parse("2026-11-28T05:00:00Z"),
    });
    expect(schichtZeiten("2026-11-27", 17 * 60, 0)?.ende).toBe(Date.parse("2026-11-27T23:00:00Z"));
  });

  it("gives a night shift 22:00 to 6:00 seven hours in March and nine in October", () => {
    const maerz = schichtZeiten("2026-03-28", 22 * 60, 6 * 60);
    const oktober = schichtZeiten("2026-10-24", 22 * 60, 6 * 60);
    expect(maerz && maerz.ende - maerz.beginn).toBe(7 * STUNDE);
    expect(oktober && oktober.ende - oktober.beginn).toBe(9 * STUNDE);
  });

  it("has no time the clocks skip, and refuses a shift without length", () => {
    expect(schichtZeiten("2026-03-29", 2 * 60 + 30, 8 * 60)).toBeNull();
    expect(schichtZeiten("2026-03-28", 22 * 60, 2 * 60 + 30)).toBeNull();
    expect(schichtZeiten("2026-11-23", 8 * 60, 8 * 60)).toBeNull();
    expect(schichtZeiten("2026-02-30", 8 * 60, 9 * 60)).toBeNull();
  });

  it("takes the first 2:30 of the night in October, in summer time", () => {
    expect(schichtZeiten("2026-10-24", 22 * 60, 2 * 60 + 30)?.ende).toBe(
      Date.parse("2026-10-25T00:30:00Z"),
    );
  });
});

describe("schichtMinuten", () => {
  it("counts the working minutes without the break, on real minutes across a change of clocks", () => {
    const zeiten = schichtZeiten("2026-10-24", 22 * 60, 6 * 60);
    if (!zeiten) throw new Error("no times");
    expect(schichtMinuten({ ...zeiten, pauseMinuten: 30 })).toBe(9 * 60 - 30);
  });
});

describe("verschoben", () => {
  it("keeps the times on the clock when a shift moves to another day", () => {
    const zeiten = schichtZeiten("2026-10-23", 22 * 60, 6 * 60);
    if (!zeiten) throw new Error("no times");
    expect(uhrzeitenVon(zeiten)).toEqual({ beginnMinute: 22 * 60, endeMinute: 6 * 60 });
    const samstag = verschoben(zeiten, "2026-10-24");
    expect(samstag && uhrzeitenVon(samstag)).toEqual({ beginnMinute: 22 * 60, endeMinute: 6 * 60 });
    expect(samstag && samstag.ende - samstag.beginn).toBe(9 * STUNDE);
  });

  it("refuses a day on which the shift's start does not exist", () => {
    const zeiten = schichtZeiten("2026-03-22", 2 * 60 + 30, 8 * 60);
    if (!zeiten) throw new Error("no times");
    expect(verschoben(zeiten, "2026-03-29")).toBeNull();
  });
});
