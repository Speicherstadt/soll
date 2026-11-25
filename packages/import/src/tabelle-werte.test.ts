import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { dauerFrei, pauseFrei, tagFrei, uhrzeitFrei } from "./tabelle-werte.ts";

describe("days as people in Germany write them and Excel saves them (S-702)", () => {
  it.each([
    ["01.09.2026", "2026-09-01"],
    ["1.9.2026", "2026-09-01"],
    ["1.9.26", "2026-09-01"],
    ["31.12.99", "2099-12-31"],
    ["2026-09-01", "2026-09-01"],
    [" 01.09.2026 ", "2026-09-01"],
    ["01.09.2026 07:00", "2026-09-01"],
    ["2026-09-01 7:00:00", "2026-09-01"],
    ["2026-09-01T07:00:00", "2026-09-01"],
    // Excel serial numbers in the 1900 system: 46266 is 1 September 2026
    ["46266", "2026-09-01"],
    ["10000", "1927-05-18"],
  ])("%s is %s", (text, tag) => {
    expect(tagFrei(text)).toBe(tag);
  });

  it.each([
    "",
    "31.09.2026",
    "29.02.2026",
    "1.9.",
    "09/01/2026",
    "2026-9-1",
    "1.9.202",
    "4626",
    "462660",
    "46266.5",
    "heute",
    "01.09.2026 x y",
  ])("%j is no day", (text) => {
    expect(tagFrei(text)).toBeNull();
  });
});

describe("times of day (S-702)", () => {
  it.each([
    ["7:00", 420],
    ["07:00", 420],
    ["7:00:00", 420],
    ["23:59", 1439],
    ["0:00", 0],
    ["700", 420],
    ["0700", 420],
    ["1530", 930],
    ["7", 420],
    ["0", 0],
    ["0,3125", 450],
    [".3125", 450],
    ["0.29166666666666669", 420],
    ["01.09.2026 07:15", 435],
    ["2026-09-01 7:15:00", 435],
  ])("%s is minute %i", (text, minuten) => {
    expect(uhrzeitFrei(text, "ab")).toBe(minuten);
    expect(uhrzeitFrei(text, "auf")).toBe(minuten);
  });

  it("rounds seconds down for a begin and up for an end, in the person's favour", () => {
    expect(uhrzeitFrei("7:00:59", "ab")).toBe(420);
    expect(uhrzeitFrei("15:29:01", "auf")).toBe(930);
    // 23:59:30 rounded up is midnight, the start of the next day
    expect(uhrzeitFrei("23:59:30", "auf")).toBe(0);
  });

  it.each([
    "",
    "24:00",
    "7:60",
    "7:5",
    "2400",
    "760",
    "25",
    "7,5",
    "1,5",
    "7.00",
    "7 Uhr",
    "-1:00",
  ])("%j is no time of day", (text) => {
    expect(uhrzeitFrei(text, "ab")).toBeNull();
  });
});

describe("durations and breaks in whole minutes, without floats (S-702)", () => {
  it.each([
    ["8", { ab: 480, auf: 480 }],
    ["7,5", { ab: 450, auf: 450 }],
    ["7.5", { ab: 450, auf: 450 }],
    ["7:30", { ab: 450, auf: 450 }],
    ["7:30:00", { ab: 450, auf: 450 }],
    ["7:30:10", { ab: 450, auf: 451 }],
    ["7,33", { ab: 439, auf: 440 }],
    [",25", { ab: 15, auf: 15 }],
    ["24", { ab: 1440, auf: 1440 }],
  ])("a duration of %s", (text, spanne) => {
    expect(dauerFrei(text)).toEqual(spanne);
  });

  it.each(["", "25", "24,5", "7,5h", "7:60", "x", "-1"])("%j is no duration", (text) => {
    expect(dauerFrei(text)).toBeNull();
  });

  it.each([
    ["", 0],
    ["30", 30],
    ["0:30", 30],
    ["0:30:00", 30],
    ["0,5", 30],
    ["0.75", 45],
    // a fraction of a minute is dropped: the break counts no longer than recorded
    ["0,33", 19],
    ["0:30:40", 30],
  ])("a break of %j is %i minutes", (text, minuten) => {
    expect(pauseFrei(text)).toBe(minuten);
  });

  it.each(["1441", "x", "-5", "0:61", "30 min"])("%j is no break", (text) => {
    expect(pauseFrei(text)).toBeNull();
  });

  it("never throws and always yields whole minutes in range", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (text) => {
        for (const wert of [uhrzeitFrei(text, "ab"), uhrzeitFrei(text, "auf"), pauseFrei(text)])
          if (wert !== null) expect(Number.isInteger(wert) && wert >= 0 && wert <= 1440).toBe(true);
        const dauer = dauerFrei(text);
        if (dauer !== null) expect(Number.isInteger(dauer.ab) && dauer.ab <= dauer.auf).toBe(true);
        const tag = tagFrei(text);
        if (tag !== null) expect(tag).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }),
    );
  });
});
