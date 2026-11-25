import { describe, expect, it } from "vitest";
import { FAKTOR, zeitgrenze } from "./zeit-testhilfen.ts";

describe("the time limit of a reader in the tests (review S-702, round 2)", () => {
  it("is the fixed limit on a free machine and grows with the slower reference on a loaded one", () => {
    expect(zeitgrenze(1000, [50, 80])).toBe(1000);
    expect(zeitgrenze(1000, [150, 300])).toBe(FAKTOR * 300);
    expect(zeitgrenze(2000, [150])).toBe(2000);
  });
});
