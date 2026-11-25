import { describe, expect, it } from "vitest";
import { formatArt, seriellAus, tagAusSeriell, uhrAusSekunden, zellText } from "./excel-zahl.ts";

describe("Excel serial numbers (ECMA-376 Part 1, 18.17.4; S-702)", () => {
  it.each([
    [1, "1900-01-01"],
    [59, "1900-02-28"],
    // 60 is 29 February 1900, which never was (kept from Lotus 1-2-3)
    [61, "1900-03-01"],
    [25569, "1970-01-01"],
    [46266, "2026-09-01"],
    [2958465, "9999-12-31"],
  ])("day %i of the 1900 system is %s", (tage, tag) => {
    expect(tagAusSeriell(tage)).toBe(tag);
  });

  it("day 0 and the 29 February 1900 are no days", () => {
    expect(tagAusSeriell(0)).toBeNull();
    expect(tagAusSeriell(60)).toBeNull();
  });

  it("counts from 1 January 1904 in the 1904 system", () => {
    expect(tagAusSeriell(0, true)).toBe("1904-01-01");
    expect(tagAusSeriell(46266 - 1462, true)).toBe("2026-09-01");
  });

  it.each([
    ["46266", { tage: 46266, sekunden: 0 }],
    ["46266.3125", { tage: 46266, sekunden: 27000 }],
    ["0.29166666666666669", { tage: 0, sekunden: 25200 }],
    ["4.6266E4", { tage: 46266, sekunden: 0 }],
    ["3.125E-1", { tage: 0, sekunden: 27000 }],
    // the last half second rounds into the next day
    ["0.999999999", { tage: 1, sekunden: 0 }],
  ])("%s is read exactly from its digits", (text, seriell) => {
    expect(seriellAus(text)).toEqual(seriell);
  });

  it.each(["", "-1", "1,5", "x", "1e999", "3000000"])("%j is no serial number", (text) => {
    expect(seriellAus(text)).toBeNull();
  });

  it("writes seconds as a clock that goes on past a day", () => {
    expect(uhrAusSekunden(27000)).toBe("7:30:00");
    expect(uhrAusSekunden(90000)).toBe("25:00:00");
  });
});

describe("number formats that show dates and times (ECMA-376 Part 1, 18.8.30)", () => {
  it.each([
    [14, undefined, "datum"],
    [20, undefined, "zeit"],
    [22, undefined, "datumzeit"],
    [0, undefined, "zahl"],
    [2, undefined, "zahl"],
    [164, "dd.mm.yyyy", "datum"],
    [165, "[$-407]dddd, d. mmmm yyyy", "datum"],
    [166, "hh:mm", "zeit"],
    [167, "[h]:mm", "zeit"],
    [168, "dd.mm.yy hh:mm", "datumzeit"],
    [169, '0.00" Std"', "zahl"],
    [170, "[Red]0.00", "zahl"],
    [171, "#,##0.00 \\h", "zahl"],
  ])("format %i %j shows a %s", (id, code, art) => {
    expect(formatArt(id, code)).toBe(art);
  });

  it("turns a number cell into the text the readers take", () => {
    expect(zellText("46266", "datum", false)).toBe("2026-09-01");
    expect(zellText("0.3125", "zeit", false)).toBe("7:30:00");
    expect(zellText("46266.3125", "datumzeit", false)).toBe("2026-09-01 7:30:00");
    expect(zellText("46266.3125", "datum", false)).toBe("2026-09-01 7:30:00");
    expect(zellText("44804", "datum", true)).toBe("2026-09-01");
    expect(zellText("7.5", "zahl", false)).toBe("7.5");
  });
});
