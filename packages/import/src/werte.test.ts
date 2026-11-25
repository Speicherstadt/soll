import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { datumLesen, minutenLesen, uhrzeitLesen } from "./werte.ts";

describe("values of an export", () => {
  it("reads days in ISO and in the German form, and only real ones", () => {
    expect(datumLesen("2026-09-01")).toBe("2026-09-01");
    expect(datumLesen("01.09.2026")).toBe("2026-09-01");
    expect(datumLesen("1.9.2026")).toBe("2026-09-01");
    expect(datumLesen(" 29.02.2028 ")).toBe("2028-02-29");
    for (const falsch of ["29.02.2027", "2026-13-01", "32.01.2026", "01.09.26", "", "heute"])
      expect(datumLesen(falsch)).toBeNull();
  });

  it("reads a time of day as minutes since midnight", () => {
    expect(uhrzeitLesen("7:00")).toBe(420);
    expect(uhrzeitLesen("07:05")).toBe(425);
    expect(uhrzeitLesen("23:59")).toBe(1439);
    expect(uhrzeitLesen("0:00")).toBe(0);
    for (const falsch of ["24:00", "7", "7:60", "7.30", "-1:00", "", "7:3"])
      expect(uhrzeitLesen(falsch)).toBeNull();
  });

  it("reads a break as whole minutes or hours and minutes, empty as none", () => {
    expect(minutenLesen("30")).toBe(30);
    expect(minutenLesen("0:45")).toBe(45);
    expect(minutenLesen("1:00")).toBe(60);
    expect(minutenLesen("")).toBe(0);
    for (const falsch of ["0,5", "-30", "1:75", "x", "99999"])
      expect(minutenLesen(falsch)).toBeNull();
  });

  it("never throws on any text", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        datumLesen(text);
        uhrzeitLesen(text);
        minutenLesen(text);
      }),
    );
  });
});
