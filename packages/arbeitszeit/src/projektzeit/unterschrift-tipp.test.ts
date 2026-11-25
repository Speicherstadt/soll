import { describe, expect, it } from "vitest";
import { unterschriftPruefen } from "./unterschrift.ts";

describe("unterschriftPruefen: a tap sent twice", () => {
  it("takes a tap sent as the same point twice for no signature, like a single tap", () => {
    expect(
      unterschriftPruefen([
        [
          [300, 100],
          [300, 100],
        ],
      ]),
    ).toBe(false);
  });
});
