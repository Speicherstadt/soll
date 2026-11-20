import { describe, expect, it } from "vitest";
import {
  ERSTE_SPERRE_MS,
  FEHLVERSUCHE_JE_TAG,
  istGesperrt,
  nachFehlversuch,
  type Sperrstand,
} from "./sperre.ts";

const OHNE: Sperrstand = { fehlversuche: 0, sperren: 0, gesperrtBis: null, fehlerTag: null };
/** A Friday morning in Hamburg (CET) */
const MORGEN = Date.parse("2026-11-20T08:00:00+01:00");

const fehlversuche = (anzahl: number, start: Sperrstand = OHNE, jetzt = MORGEN) =>
  Array.from({ length: anzahl }).reduce<Sperrstand>(
    (stand) => nachFehlversuch(stand, jetzt),
    start,
  );

describe("lock of a terminal", () => {
  it("counts four wrong tries without locking", () => {
    const stand = fehlversuche(4);
    expect(stand).toEqual({
      fehlversuche: 4,
      sperren: 0,
      gesperrtBis: null,
      fehlerTag: "2026-11-20",
    });
    expect(istGesperrt(stand, MORGEN)).toBe(false);
  });

  it("locks for one minute on the fifth", () => {
    const stand = fehlversuche(5);
    expect(stand).toMatchObject({
      fehlversuche: 0,
      sperren: 1,
      gesperrtBis: MORGEN + ERSTE_SPERRE_MS,
    });
    expect(istGesperrt(stand, MORGEN + ERSTE_SPERRE_MS - 1)).toBe(true);
    expect(istGesperrt(stand, MORGEN + ERSTE_SPERRE_MS)).toBe(false);
  });

  it("waits one, two and four minutes, then until midnight on the twentieth wrong try", () => {
    const bis: (number | null)[] = [];
    let stand = OHNE;
    for (let i = 0; i < FEHLVERSUCHE_JE_TAG / 5; i++) {
      stand = fehlversuche(5, stand);
      bis.push(stand.gesperrtBis);
    }
    expect(bis).toEqual([
      MORGEN + 60_000,
      MORGEN + 120_000,
      MORGEN + 240_000,
      Date.parse("2026-11-21T00:00:00+01:00"),
    ]);
  });

  it("locks until midnight in summer time too", () => {
    const sommer = Date.parse("2026-07-10T22:30:00+02:00");
    expect(fehlversuche(FEHLVERSUCHE_JE_TAG, OHNE, sommer).gesperrtBis).toBe(
      Date.parse("2026-07-11T00:00:00+02:00"),
    );
  });

  it("starts the counts afresh on a new day", () => {
    const gestern = fehlversuche(FEHLVERSUCHE_JE_TAG - 1);
    const heute = nachFehlversuch(gestern, Date.parse("2026-11-21T08:00:00+01:00"));
    expect(heute).toMatchObject({ fehlversuche: 1, sperren: 0, fehlerTag: "2026-11-21" });
  });
});
