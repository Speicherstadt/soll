import { minuteInBerlin, tagInBerlin } from "@soll/arbeitszeit";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { berlinerUhr } from "./uhr.ts";

/* The fast Berlin clock gives what the slow one gives, on the days of the change too (S-705) */

const MINUTE = 60_000;

describe("berlinerUhr", () => {
  it("shows the day and minute tagInBerlin and minuteInBerlin show", () => {
    const uhr = berlinerUhr();
    fc.assert(
      fc.property(
        fc.integer({ min: Date.UTC(2000, 0, 1) / MINUTE, max: Date.UTC(2099, 11, 31) / MINUTE }),
        (minute) => {
          const ms = minute * MINUTE;
          expect(uhr.uhr(ms)).toEqual({ tag: tagInBerlin(ms), minute: minuteInBerlin(ms) });
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("follows the change in spring and the hour that comes twice in October", () => {
    const uhr = berlinerUhr();
    for (const text of [
      "2026-03-29T00:59:00Z",
      "2026-03-29T01:00:00Z",
      "2026-10-25T00:30:00Z",
      "2026-10-25T01:30:00Z",
      "2026-10-25T22:59:00Z",
      "2026-10-25T23:00:00Z",
    ]) {
      const ms = Date.parse(text);
      expect(uhr.uhr(ms)).toEqual({ tag: tagInBerlin(ms), minute: minuteInBerlin(ms) });
    }
    expect(uhr.doppelt(Date.parse("2026-10-25T01:30:00Z"))).toBe(true);
    expect(uhr.doppelt(Date.parse("2026-10-25T00:30:00Z"))).toBe(false);
  });
});
