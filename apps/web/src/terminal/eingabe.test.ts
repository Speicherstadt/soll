import { describe, expect, it } from "vitest";
import { codeAnzeige, pinNach, pinVollstaendig, sekundenBis, tasteAus } from "./eingabe.ts";

const ziffer = (z: string) => ({ art: "ziffer", ziffer: z }) as const;

describe("the number pad", () => {
  it("takes digits up to eight and deletes the last", () => {
    const pin = "12345678";
    expect(pinNach("471", ziffer("1"))).toBe("4711");
    expect(pinNach(pin, ziffer("9"))).toBe(pin);
    expect(pinNach("4711", { art: "loeschen" })).toBe("471");
    expect(pinNach("", { art: "loeschen" })).toBe("");
    expect(pinNach("47", { art: "ok" })).toBe("47");
    expect(pinNach("47", ziffer("x"))).toBe("47");
  });

  it("confirms from four digits on", () => {
    expect(pinVollstaendig("471")).toBe(false);
    expect(pinVollstaendig("4711")).toBe(true);
  });

  it("reads the keyboard", () => {
    expect(tasteAus("7")).toEqual(ziffer("7"));
    expect(tasteAus("Backspace")).toEqual({ art: "loeschen" });
    expect(tasteAus("Enter")).toEqual({ art: "ok" });
    expect(tasteAus("a")).toBeNull();
  });
});

describe("the pairing code", () => {
  it("shows two groups of four however it was typed", () => {
    expect(codeAnzeige("abcdefgh")).toBe("ABCD-EFGH");
    expect(codeAnzeige("AB CD-EF GH")).toBe("ABCD-EFGH");
    expect(codeAnzeige("abc")).toBe("ABC");
  });
});

describe("seconds left", () => {
  it("rounds up and stops at zero", () => {
    expect(sekundenBis(61_000, 0)).toBe(61);
    expect(sekundenBis(60_001, 0)).toBe(61);
    expect(sekundenBis(0, 5)).toBe(0);
  });
});
