import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { schreiber, schriften } from "./schreiber.ts";

const neuerSchreiber = async () => {
  const doc = await PDFDocument.create();
  return schreiber(doc, await schriften(doc));
};

describe("wrapping text in the PDF writer", () => {
  it("never breaks at a no-break space: a number keeps its unit", async () => {
    const s = await neuerSchreiber();
    for (const leer of [" ", " ", " "]) {
      const zeilen = s.umbrechen(`Rohrleitung 15${leer}mm`, 0, { breite: 70 });
      expect(zeilen.some((zeile) => zeile.endsWith("15"))).toBe(false);
      expect(zeilen.join(" ")).not.toContain("?");
    }
  });

  it("breaks at any other blank space", async () => {
    const s = await neuerSchreiber();
    expect(s.umbrechen("Rohrleitung verlegt", 0, { breite: 50 })).toEqual([
      "Rohrleitung",
      "verlegt",
    ]);
  });

  it("leaves out a byte order mark (U+FEFF) instead of making it a space", async () => {
    const s = await neuerSchreiber();
    expect(s.umbrechen("15\ufeffmm", 0, { breite: 500 })).toEqual(["15mm"]);
  });
});
