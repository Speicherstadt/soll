import { describe, expect, it } from "vitest";
import { aktionenFuer, minuteAus } from "./aktionen.ts";

describe("the buttons of Heute", () => {
  it("offer Kommen while out, and nothing else", () => {
    expect(aktionenFuer("aus")).toEqual({ haupt: { art: "kommen", name: "kommen" }, neben: null });
  });

  it("offer the break as the big button and Gehen beside it while working", () => {
    expect(aktionenFuer("arbeit")).toEqual({
      haupt: { art: "pause_beginn", name: "pause_starten" },
      neben: { art: "gehen", name: "gehen" },
    });
  });

  it("offer the end of the break and Gehen while on a break", () => {
    expect(aktionenFuer("pause")).toEqual({
      haupt: { art: "pause_ende", name: "pause_beenden" },
      neben: { art: "gehen", name: "gehen" },
    });
  });
});

describe("a time typed in", () => {
  it("reads 7:30, 07:30 and 0730 as minutes of the day", () => {
    expect(minuteAus("7:30")).toBe(450);
    expect(minuteAus("07:30")).toBe(450);
    expect(minuteAus("0730")).toBe(450);
    expect(minuteAus(" 23:59 ")).toBe(23 * 60 + 59);
  });

  it("refuses what is no time of day", () => {
    for (const text of ["24:00", "12:60", "7", "7:3", "abc", "", "-1:00"])
      expect(minuteAus(text), text).toBeNull();
  });
});
