import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { saldoMinutenLesen, urlaubHalbtageLesen } from "./saldo-werte.ts";

describe("saldoMinutenLesen: overtime on a cut-off date (S-708)", () => {
  it.each([
    ["12:30", 750],
    ["-12:30", -750],
    ["−3:15", -195],
    ["+0:45", 45],
    ["0:00", 0],
    ["-0:00", 0],
    ["7,5", 450],
    ["7.5", 450],
    ["-0,25", -15],
    ["8", 480],
    [" -8 ", -480],
    ["1234:05", 74_045],
    ["7,05", 423],
  ])("%s → %i minutes", (text, minuten) => {
    expect(saldoMinutenLesen(text)).toBe(minuten);
  });

  it.each(["", "-", "abc", "7,33", "12:60", "1:5", "--3", "7,5h", "1e3", "100001", "3:15:00"])(
    "refuses %j",
    (text) => {
      expect(saldoMinutenLesen(text)).toBeNull();
    },
  );
});

describe("urlaubHalbtageLesen: leave on a cut-off date (S-708)", () => {
  it.each([
    ["8", 16],
    ["8,5", 17],
    ["8.5", 17],
    ["0", 0],
    ["12,0", 24],
    ["8,50", 17],
  ])("%s → %i half days", (text, halbtage) => {
    expect(urlaubHalbtageLesen(text)).toBe(halbtage);
  });

  it.each(["", "-1", "8,3", "8,25", "acht", "+2", "10001"])("refuses %j", (text) => {
    expect(urlaubHalbtageLesen(text)).toBeNull();
  });
});

describe("the readers of balances never throw and give whole numbers only", () => {
  it("for any text", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (text) => {
        const minuten = saldoMinutenLesen(text);
        const halbtage = urlaubHalbtageLesen(text);
        expect(minuten === null || Number.isSafeInteger(minuten)).toBe(true);
        expect(halbtage === null || (Number.isSafeInteger(halbtage) && halbtage >= 0)).toBe(true);
      }),
    );
  });

  it("reads back what it would write: minutes as H:MM with a sign", () => {
    fc.assert(
      fc.property(fc.integer({ min: -6_000_000, max: 6_000_000 }), (minuten) => {
        const betrag = Math.abs(minuten);
        const text = `${minuten < 0 ? "-" : ""}${Math.floor(betrag / 60)}:${String(betrag % 60).padStart(2, "0")}`;
        expect(saldoMinutenLesen(text)).toBe(minuten);
      }),
    );
  });
});
