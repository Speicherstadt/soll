import { describe, expect, it } from "vitest";
import { aufMinuten, ohne, vereinigt } from "./spannen.ts";

const M = 60_000;
const s = (beginn: number, ende: number) => ({ beginn: beginn * M, ende: ende * M });

describe("spans of time", () => {
  it("merges spans that overlap or touch, in time order", () => {
    expect(vereinigt([s(30, 40), s(0, 10), s(10, 20), s(15, 18)])).toEqual([s(0, 20), s(30, 40)]);
  });

  it("cuts out what another set covers", () => {
    expect(ohne([s(0, 100)], [s(10, 20), s(15, 30), s(90, 120)])).toEqual([s(0, 10), s(30, 90)]);
    expect(ohne([s(0, 10)], [s(0, 10)])).toEqual([]);
    expect(ohne([s(0, 10), s(20, 30)], [])).toEqual([s(0, 10), s(20, 30)]);
  });

  it("rounds a start down and an end up to the minute", () => {
    expect(aufMinuten({ beginn: 10 * M + 59_999, ende: 20 * M + 1 })).toEqual(s(10, 21));
    expect(aufMinuten(s(10, 20))).toEqual(s(10, 20));
  });
});
