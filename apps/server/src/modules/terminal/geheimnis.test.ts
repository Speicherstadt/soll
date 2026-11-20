import { describe, expect, it } from "vitest";
import {
  CODE_LAENGE,
  CODE_ZEICHEN,
  codeNormalisieren,
  kopplungscode,
  pinKennung,
  pinSchluesselAus,
  zufallsToken,
} from "./geheimnis.ts";

describe("secrets of the terminal", () => {
  it("draws codes of eight unambiguous letters", () => {
    for (let i = 0; i < 200; i++) {
      const code = kopplungscode();
      expect(code).toHaveLength(CODE_LAENGE);
      expect([...code].every((zeichen) => CODE_ZEICHEN.includes(zeichen))).toBe(true);
    }
    expect(CODE_ZEICHEN).not.toMatch(/[01OI]/);
  });

  it("reads a code typed in lower case with a dash and spaces", () => {
    expect(codeNormalisieren(" abcd-efgh ")).toBe("ABCDEFGH");
  });

  it("makes tokens of 32 random bytes", () => {
    const token = zufallsToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(zufallsToken()).not.toBe(token);
  });

  it("keys the PIN lookup by the secret and the business", () => {
    const a = pinSchluesselAus(new Uint8Array(32).fill(1));
    const b = pinSchluesselAus(new Uint8Array(32).fill(2));
    expect(pinKennung(a, "weber", "4711")).toBe(pinKennung(a, "weber", "4711"));
    expect(pinKennung(a, "weber", "4711")).not.toBe(pinKennung(b, "weber", "4711"));
    expect(pinKennung(a, "weber", "4711")).not.toBe(pinKennung(a, "elbblick", "4711"));
    expect(pinKennung(a, "weber", "4711")).not.toContain("4711");
  });
});
