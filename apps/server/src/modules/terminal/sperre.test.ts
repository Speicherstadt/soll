import { describe, expect, it } from "vitest";
import {
  ERSTE_SPERRE_MS,
  istGesperrt,
  LAENGSTE_SPERRE_MS,
  mussZuruecksetzen,
  nachFehlversuch,
  OHNE_SPERRE,
  type Sperrstand,
} from "./sperre.ts";

const fehlversuche = (anzahl: number, start: Sperrstand = OHNE_SPERRE, jetzt = 0) =>
  Array.from({ length: anzahl }).reduce<Sperrstand>(
    (stand) => nachFehlversuch(stand, jetzt),
    start,
  );

describe("lock of a terminal", () => {
  it("counts four wrong tries without locking", () => {
    const stand = fehlversuche(4);
    expect(stand).toEqual({ fehlversuche: 4, sperren: 0, gesperrtBis: null });
    expect(istGesperrt(stand, 0)).toBe(false);
  });

  it("locks for one minute on the fifth", () => {
    const stand = fehlversuche(5, OHNE_SPERRE, 1000);
    expect(stand).toEqual({ fehlversuche: 0, sperren: 1, gesperrtBis: 1000 + ERSTE_SPERRE_MS });
    expect(istGesperrt(stand, 1000 + ERSTE_SPERRE_MS - 1)).toBe(true);
    expect(istGesperrt(stand, 1000 + ERSTE_SPERRE_MS)).toBe(false);
  });

  it("doubles each further lock up to 15 minutes", () => {
    const dauern: number[] = [];
    let stand = OHNE_SPERRE;
    for (let i = 0; i < 6; i++) {
      stand = fehlversuche(5, stand, 0);
      dauern.push(stand.gesperrtBis ?? -1);
    }
    expect(dauern).toEqual([1, 2, 4, 8, 15, 15].map((minuten) => minuten * 60_000));
    expect(Math.max(...dauern)).toBe(LAENGSTE_SPERRE_MS);
  });

  it("has something to reset only after a wrong try", () => {
    expect(mussZuruecksetzen(OHNE_SPERRE)).toBe(false);
    expect(mussZuruecksetzen(fehlversuche(1))).toBe(true);
    expect(mussZuruecksetzen(fehlversuche(5))).toBe(true);
  });
});
