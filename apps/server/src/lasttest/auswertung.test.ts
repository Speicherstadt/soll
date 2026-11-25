import { describe, expect, it } from "vitest";
import { auswerten, perzentil } from "./auswertung.ts";

const ok = (dauerMs: number) => ({ dauerMs, status: 201 });

describe("evaluating a load test (S-904)", () => {
  it("takes the nearest rank: p95 of 1..100 is 95, p50 of four values the second", () => {
    const hundert = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(perzentil(hundert, 95)).toBe(95);
    expect(perzentil(hundert, 100)).toBe(100);
    expect(perzentil([10, 20, 30, 40], 50)).toBe(20);
    expect(perzentil([7], 99)).toBe(7);
    expect(perzentil([], 95)).toBe(0);
  });

  it("passes at the threshold and fails one millisecond above it", () => {
    const schwelle = { p95Ms: 100, maxMs: 200 };
    const grenze = [...Array.from({ length: 19 }, () => ok(100)), ok(200)];
    expect(auswerten(grenze, 20, schwelle)).toMatchObject({
      p95Ms: 100,
      maxMs: 200,
      bestanden: true,
      gruende: [],
    });
    const drueber = [...Array.from({ length: 19 }, () => ok(101)), ok(201)];
    expect(auswerten(drueber, 20, schwelle).gruende).toEqual([
      "p95 101 ms > 100 ms",
      "max 201 ms > 200 ms",
    ]);
  });

  it("fails on a single error or a request not made, and counts each status", () => {
    const schwelle = { p95Ms: 1_000, maxMs: 1_000 };
    const messungen = [ok(5), ok(6), { dauerMs: 7, status: 500 }, { dauerMs: 8, status: 0 }];
    expect(auswerten(messungen, 5, schwelle)).toMatchObject({
      fehler: 2,
      status: { "500": 1, "0": 1 },
      bestanden: false,
      gruende: ["4 of 5 requests made", "2 requests without 201"],
    });
  });
});
