import { describe, expect, it } from "vitest";
import { zielNach } from "./tastatur.ts";

describe("zielNach", () => {
  it("moves the target between people with up and down and between days with left and right", () => {
    expect(zielNach("ArrowDown", { zeile: 0, spalte: 2 }, 3, 7)).toEqual({ zeile: 1, spalte: 2 });
    expect(zielNach("ArrowUp", { zeile: 1, spalte: 2 }, 3, 7)).toEqual({ zeile: 0, spalte: 2 });
    expect(zielNach("ArrowRight", { zeile: 1, spalte: 2 }, 3, 7)).toEqual({ zeile: 1, spalte: 3 });
    expect(zielNach("ArrowLeft", { zeile: 1, spalte: 2 }, 3, 7)).toEqual({ zeile: 1, spalte: 1 });
  });

  it("stops at the edges, Home and End jump to Monday and Sunday", () => {
    expect(zielNach("ArrowUp", { zeile: 0, spalte: 0 }, 3, 7)).toEqual({ zeile: 0, spalte: 0 });
    expect(zielNach("ArrowRight", { zeile: 2, spalte: 6 }, 3, 7)).toEqual({ zeile: 2, spalte: 6 });
    expect(zielNach("Home", { zeile: 2, spalte: 4 }, 3, 7)).toEqual({ zeile: 2, spalte: 0 });
    expect(zielNach("End", { zeile: 2, spalte: 4 }, 3, 7)).toEqual({ zeile: 2, spalte: 6 });
  });

  it("mirrors left and right in right-to-left text and ignores other keys", () => {
    expect(zielNach("ArrowLeft", { zeile: 0, spalte: 2 }, 3, 7, true)).toEqual({
      zeile: 0,
      spalte: 3,
    });
    expect(zielNach("a", { zeile: 0, spalte: 2 }, 3, 7)).toBeUndefined();
  });
});
