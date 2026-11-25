import { describe, expect, it } from "vitest";
import { aufFlaeche, FLAECHE, type Striche, unterschriftPruefen } from "./unterschrift.ts";

const strich = (punkte: number) =>
  Array.from({ length: punkte }, (_, i) => [i % FLAECHE.breite, 100] as [number, number]);

describe("aufFlaeche", () => {
  it("maps a point on the drawn surface to whole numbers on the fixed surface", () => {
    // a canvas 300 × 100 px on the phone: half the size of the surface
    expect(aufFlaeche({ x: 150, y: 50 }, { breite: 300, hoehe: 100 })).toEqual([300, 100]);
    expect(aufFlaeche({ x: 0.4, y: 0.2 }, { breite: 600, hoehe: 200 })).toEqual([0, 0]);
  });

  it("keeps a point drawn past the edge on the surface", () => {
    expect(aufFlaeche({ x: -20, y: 130 }, { breite: 300, hoehe: 100 })).toEqual([0, 200]);
    expect(aufFlaeche({ x: 400, y: -1 }, { breite: 300, hoehe: 100 })).toEqual([600, 0]);
  });
});

describe("unterschriftPruefen", () => {
  it("takes strokes of whole numbers on the surface", () => {
    const striche: Striche = [
      [
        [10, 20],
        [30, 40],
      ],
      [[50, 60]],
    ];
    expect(unterschriftPruefen(striche)).toBe(true);
  });

  it("refuses an empty signature or one without a line", () => {
    expect(unterschriftPruefen([])).toBe(false);
    expect(unterschriftPruefen([[[10, 20]]])).toBe(false);
    expect(unterschriftPruefen([[]])).toBe(false);
  });

  it("refuses fractions, points off the surface and too many points", () => {
    expect(
      unterschriftPruefen([
        [
          [1.5, 2],
          [3, 4],
        ],
      ]),
    ).toBe(false);
    expect(
      unterschriftPruefen([
        [
          [0, 0],
          [FLAECHE.breite + 1, 0],
        ],
      ]),
    ).toBe(false);
    expect(
      unterschriftPruefen([
        [
          [0, -1],
          [1, 1],
        ],
      ]),
    ).toBe(false);
    expect(unterschriftPruefen([strich(FLAECHE.punkte)])).toBe(true);
    expect(unterschriftPruefen([strich(FLAECHE.punkte + 1)])).toBe(false);
    expect(unterschriftPruefen(Array.from({ length: FLAECHE.striche + 1 }, () => strich(2)))).toBe(
      false,
    );
  });
});
