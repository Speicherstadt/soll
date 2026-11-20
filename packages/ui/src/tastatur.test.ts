import { describe, expect, it } from "vitest";
import { naechsterIndex } from "./tastatur.ts";

describe("naechsterIndex", () => {
  it("moves down and up a vertical list and wraps", () => {
    expect(naechsterIndex("ArrowDown", 0, 3, "vertikal")).toBe(1);
    expect(naechsterIndex("ArrowDown", 2, 3, "vertikal")).toBe(0);
    expect(naechsterIndex("ArrowUp", 0, 3, "vertikal")).toBe(2);
  });

  it("jumps to the first and last item", () => {
    expect(naechsterIndex("Home", 2, 3, "horizontal")).toBe(0);
    expect(naechsterIndex("End", 0, 3, "horizontal")).toBe(2);
  });

  it("swaps left and right in right-to-left text", () => {
    expect(naechsterIndex("ArrowRight", 0, 3, "horizontal")).toBe(1);
    expect(naechsterIndex("ArrowLeft", 0, 3, "horizontal", true)).toBe(1);
    expect(naechsterIndex("ArrowRight", 0, 3, "horizontal", true)).toBe(2);
  });

  it("ignores other keys and empty lists", () => {
    expect(naechsterIndex("a", 0, 3, "vertikal")).toBeUndefined();
    expect(naechsterIndex("ArrowLeft", 0, 3, "vertikal")).toBeUndefined();
    expect(naechsterIndex("ArrowDown", 0, 0, "vertikal")).toBeUndefined();
  });
});
