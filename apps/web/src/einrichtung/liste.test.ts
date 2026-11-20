import { describe, expect, it } from "vitest";
import { ergaenzt } from "./liste.ts";

const id = (eintrag: { id: string }) => eintrag.id;

describe("ergaenzt", () => {
  it("keeps what was added before the load answered", () => {
    expect(ergaenzt([], [{ id: "a" }], id)).toEqual([{ id: "a" }]);
  });

  it("takes the loaded entries first and each entry once", () => {
    expect(ergaenzt([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }], id)).toEqual([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
  });

  it("does not bring back an entry removed on the page before the load answered", () => {
    expect(ergaenzt([{ id: "a" }, { id: "b" }], [{ id: "b" }], id, new Set(["a"]))).toEqual([
      { id: "b" },
    ]);
  });
});
