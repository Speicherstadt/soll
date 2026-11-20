import { describe, expect, it } from "vitest";
import { windows1252 } from "./zeichensatz.ts";

describe("windows1252: the character set of the DATEV ASCII import", () => {
  it("keeps ASCII byte for byte, CR LF included", () => {
    expect([...windows1252("1;01.11.2026;\r\n")]).toEqual([
      0x31, 0x3b, 0x30, 0x31, 0x2e, 0x31, 0x31, 0x2e, 0x32, 0x30, 0x32, 0x36, 0x3b, 0x0d, 0x0a,
    ]);
  });

  it("writes Latin-1 letters as one byte each (é, ä, ß)", () => {
    expect([...windows1252("éäß")]).toEqual([0xe9, 0xe4, 0xdf]);
  });

  it("writes the letters Windows-1252 puts at 0x80–0x9F (€, „, “)", () => {
    expect([...windows1252("€„“")]).toEqual([0x80, 0x84, 0x93]);
  });

  it("refuses a character Windows-1252 cannot hold instead of guessing", () => {
    expect(() => windows1252("Ł")).toThrow();
    expect(() => windows1252("\u0081")).toThrow();
  });
});
