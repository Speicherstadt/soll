import { describe, expect, it } from "vitest";
import { falten, inhaltszeile, textWert, utcZeit } from "./zeilen.ts";

/* The content lines of iCalendar (RFC 5545, Sections 3.1, 3.3.5 and 3.3.11) */

const oktette = (zeile: string) => new TextEncoder().encode(zeile).length;

describe("textWert (RFC 5545, 3.3.11)", () => {
  it("escapes backslash, semicolon and comma with a backslash", () => {
    expect(textWert("a\\b;c,d")).toBe("a\\\\b\\;c\\,d");
  });

  it("writes a line break as \\n, also CR LF and a lone CR", () => {
    expect(textWert("eins\r\nzwei\ndrei\rvier")).toBe("eins\\nzwei\\ndrei\\nvier");
  });

  it("leaves a colon and double quotes as they are (SHALL NOT be escaped)", () => {
    expect(textWert('Pause: 30 min "Theke"')).toBe('Pause: 30 min "Theke"');
  });

  it("drops the other control characters, which TEXT does not allow", () => {
    expect(textWert("a\u0007b\u0000c\td")).toBe("abc\td");
  });
});

describe("utcZeit (RFC 5545, 3.3.5, form #2)", () => {
  it("writes an instant in UTC with the Z", () => {
    expect(utcZeit(Date.UTC(2026, 10, 23, 13, 0, 0))).toBe("20261123T130000Z");
  });

  it("drops milliseconds, which DATE-TIME has no place for", () => {
    expect(utcZeit(Date.UTC(2026, 0, 2, 3, 4, 5, 678))).toBe("20260102T030405Z");
  });
});

describe("falten (RFC 5545, 3.1)", () => {
  it("leaves a line of 75 octets as it is", () => {
    const zeile = `SUMMARY:${"x".repeat(67)}`;
    expect(oktette(zeile)).toBe(75);
    expect(falten(zeile)).toBe(zeile);
  });

  it("folds a longer line with CRLF and one space, no part longer than 75 octets", () => {
    const zeile = `DESCRIPTION:${"a".repeat(200)}`;
    const gefaltet = falten(zeile);
    const teile = gefaltet.split("\r\n");
    expect(teile.length).toBe(3);
    for (const teil of teile) expect(oktette(teil)).toBeLessThanOrEqual(75);
    for (const teil of teile.slice(1)) expect(teil.startsWith(" ")).toBe(true);
    // unfolding removes CRLF and the one white space after it
    expect(gefaltet.replaceAll("\r\n ", "")).toBe(zeile);
  });

  it("never splits a UTF-8 multi-octet sequence (3.1, the note on simple implementations)", () => {
    const zeile = `SUMMARY:${"ü".repeat(50)}${"😀".repeat(20)}${"خ".repeat(30)}`;
    const teile = falten(zeile).split("\r\n");
    for (const teil of teile) {
      expect(oktette(teil)).toBeLessThanOrEqual(75);
      // each part is valid UTF-8 on its own: no replacement character after a round trip
      expect(new TextDecoder("utf-8", { fatal: true }).decode(new TextEncoder().encode(teil))).toBe(
        teil,
      );
    }
    expect(teile.join("\r\n").replaceAll("\r\n ", "")).toBe(zeile);
  });
});

describe("inhaltszeile", () => {
  it("puts name and value together and folds", () => {
    expect(inhaltszeile("LOCATION", "Elbe")).toBe("LOCATION:Elbe");
    expect(falten(inhaltszeile("X", "y".repeat(80))).includes("\r\n ")).toBe(true);
  });
});
