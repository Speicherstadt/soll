import { describe, expect, it } from "vitest";
import { formatPruefwert, parsePruefwert } from "./pruefwert.ts";

// Cases from firsttris/haben, packages/gobd-kern/src/pruefwert.test.ts
const hash = "ab".repeat(32);

describe("Prüfwert", () => {
  it("writes number and hash and reads them back", () => {
    const text = formatPruefwert({ seq: 1234, hash });
    expect(text).toBe(`Nr. 1234 · ${hash}`);
    expect(parsePruefwert(text)).toEqual({ seq: 1234, hash });
  });

  it("reads tolerantly: line breaks, capitals, other text before", () => {
    expect(parsePruefwert(`Prüfwert: Nr. 7\n· ${hash.toUpperCase()}`)).toEqual({ seq: 7, hash });
  });

  it("returns null without a complete hash", () => {
    expect(parsePruefwert("Nr. 7 · abc")).toBeNull();
  });
});
