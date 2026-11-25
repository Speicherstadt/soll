import { describe, expect, it } from "vitest";
import { halbtageAus, minutenAus } from "./eingabe.ts";

describe("minutenAus: hours as typed, in whole minutes", () => {
  it("reads h:mm with and without a sign", () => {
    expect(minutenAus("7:30")).toBe(450);
    expect(minutenAus("+0:05")).toBe(5);
    expect(minutenAus("-1:30")).toBe(-90);
    expect(minutenAus("−2:00")).toBe(-120);
    expect(minutenAus(" 12 ")).toBe(720);
  });

  it("refuses what is no duration", () => {
    for (const text of ["", "1:60", "1,5", "abc", "1:5", ":30"])
      expect(minutenAus(text), text).toBeNull();
  });
});

describe("halbtageAus: days as typed, in half days", () => {
  it("reads whole and half days with a comma or a point, with a sign", () => {
    expect(halbtageAus("3")).toBe(6);
    expect(halbtageAus("2,5")).toBe(5);
    expect(halbtageAus("0.5")).toBe(1);
    expect(halbtageAus("-1,5")).toBe(-3);
  });

  it("refuses a smaller part than a half day", () => {
    for (const text of ["", "1,25", "0,3", "x"]) expect(halbtageAus(text), text).toBeNull();
  });
});
