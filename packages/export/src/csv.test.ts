import { describe, expect, it } from "vitest";
import { csvDatei, csvZelle } from "./csv.ts";

describe("csvZelle", () => {
  it("leaves plain text and numbers as they are", () => {
    expect(csvZelle("Sandra Kühn")).toBe("Sandra Kühn");
    expect(csvZelle(450)).toBe("450");
    expect(csvZelle("")).toBe("");
  });

  it("quotes a cell with the separator, a quote or a line break (RFC 4180, 2.6 and 2.7)", () => {
    expect(csvZelle("a;b")).toBe('"a;b"');
    expect(csvZelle('sagt "nein"')).toBe('"sagt ""nein"""');
    expect(csvZelle("eins\ndrei")).toBe('"eins\ndrei"');
  });

  it("puts an apostrophe before what a spreadsheet would read as a formula (CSV injection)", () => {
    expect(csvZelle("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvZelle("+49 40")).toBe("'+49 40");
    expect(csvZelle("-0:15")).toBe("'-0:15");
    expect(csvZelle("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvZelle("\tx")).toBe("'\tx");
    expect(csvZelle("\rx")).toBe('"\'\rx"');
    expect(csvZelle("=1;2")).toBe('"\'=1;2"');
  });

  it("never guards a number, so negative minutes stay numbers", () => {
    expect(csvZelle(-15)).toBe("-15");
  });
});

describe("csvDatei", () => {
  it("is UTF-8 with BOM, separated by semicolons, lines ending in CRLF", () => {
    const datei = csvDatei([
      ["Person", "Dauer (Minuten)"],
      ["Lea Schröder", 450],
    ]);
    expect(datei).toBe("﻿Person;Dauer (Minuten)\r\nLea Schröder;450\r\n");
  });
});
