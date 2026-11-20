import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { csvZeilen } from "./csv.ts";

// RFC 4180, section 2: fields in double quotes may hold the separator, line breaks and "" for a quote
describe("csvZeilen", () => {
  it("splits records and fields", () => {
    expect(csvZeilen("a,b\r\nc,d\n", ",")).toEqual([
      { zeile: 1, felder: ["a", "b"] },
      { zeile: 2, felder: ["c", "d"] },
    ]);
  });

  it("keeps separators, line breaks and doubled quotes inside quotes (RFC 4180, 2.6 and 2.7)", () => {
    expect(csvZeilen('"Weber; Jonas";"sagt ""Moin""\nzweimal"\nx;y', ";")).toEqual([
      { zeile: 1, felder: ["Weber; Jonas", 'sagt "Moin"\nzweimal'] },
      { zeile: 3, felder: ["x", "y"] },
    ]);
  });

  it("skips empty lines and counts them in the line numbers", () => {
    expect(csvZeilen("a\n\n\nb", ",")).toEqual([
      { zeile: 1, felder: ["a"] },
      { zeile: 4, felder: ["b"] },
    ]);
  });

  it("never throws and keeps every field of a quoted round trip", () => {
    const feld = fc.string({ maxLength: 12 });
    fc.assert(
      fc.property(
        fc.array(fc.array(feld, { minLength: 2, maxLength: 4 }), { maxLength: 6 }),
        (zeilen) => {
          const text = zeilen
            .map((felder) => felder.map((f) => `"${f.replaceAll('"', '""')}"`).join(";"))
            .join("\r\n");
          expect(csvZeilen(text, ";").map((z) => z.felder)).toEqual(zeilen);
        },
      ),
    );
    fc.assert(fc.property(fc.string(), (text) => void csvZeilen(text, ",")));
  });
});
