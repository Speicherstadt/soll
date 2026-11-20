import { describe, expect, it } from "vitest";
import { betragText, datumText, stundenText } from "./zahlen.ts";

describe("stundenText: decimal hours with a decimal comma from whole minutes", () => {
  it.each([
    [0, "0,00"],
    [60, "1,00"],
    [90, "1,50"],
    [45, "0,75"],
    [9_150, "152,50"],
  ])("%i minutes are %s hours", (minuten, text) => {
    expect(stundenText(minuten)).toBe(text);
  });

  it.each([
    [1, "0,02"],
    [7, "0,12"],
    [20, "0,34"],
    [40, "0,67"],
    [10_001, "166,69"],
  ])("rounds up to the hundredth, never to the person's disadvantage: %i min → %s", (min, text) => {
    expect(stundenText(min)).toBe(text);
  });

  it("refuses negative and fractional minutes", () => {
    expect(() => stundenText(-1)).toThrow();
    expect(() => stundenText(1.5)).toThrow();
  });
});

describe("betragText: euros with a decimal comma from whole cents", () => {
  it.each([
    [0, "0,00"],
    [5, "0,05"],
    [5_600, "56,00"],
    [123_456, "1234,56"],
  ])("%i cents are %s", (cent, text) => {
    expect(betragText(cent)).toBe(text);
  });

  it("refuses negative and fractional cents", () => {
    expect(() => betragText(-1)).toThrow();
    expect(() => betragText(0.5)).toThrow();
  });
});

describe("datumText", () => {
  it("writes a day as TT.MM.JJJJ", () => {
    expect(datumText("2026-11-01")).toBe("01.11.2026");
  });
});
