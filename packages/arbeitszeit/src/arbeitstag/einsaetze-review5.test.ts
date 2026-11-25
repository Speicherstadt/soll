import { describe, expect, it } from "vitest";
import { type Arbeitstag, arbeitstage } from "./arbeitstag.ts";
import { gehen, kommen, SPAETER, tage, um } from "./testhilfen.ts";

/*
 * Review S-505, round 5 (R-12, R-29: a call-out gets what the same times stamped would get):
 * call-outs and stamped pairs that do not overlap, as call-outs and as stamps, must give the same
 * working days with the same minutes. Taken from the review, on `arbeitstage` with call-outs.
 */

const MINUTE = 60_000;
const START = um("2026-10-20T00:00+02:00");

/** mulberry32 */
const zufall = (seed: number) => {
  let zustand = seed;
  return () => {
    zustand = (zustand + 0x6d2b79f5) | 0;
    let t = Math.imul(zustand ^ (zustand >>> 15), zustand | 1);
    t = t ^ (t + Math.imul(t ^ (t >>> 7), t | 61));
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const spannen = (r: () => number) => {
  const liste: { beginn: number; ende: number; einsatz: boolean }[] = [];
  let t = START;
  for (let i = 0; i < 6; i++) {
    t += Math.floor(r() * 14 * 60) * MINUTE + MINUTE;
    const ende = t + (Math.floor(r() * 5 * 60) + 1) * MINUTE;
    liste.push({ beginn: t, ende, einsatz: r() < 0.5 });
    t = ende;
  }
  return liste;
};

const alsTage = (ergebnis: readonly Arbeitstag[]) =>
  ergebnis.map((tag) => [tag.tag, tag.arbeitsMinuten]);

const mitEinsaetzen = (
  stempel: Parameters<typeof arbeitstage>[0],
  einsaetze: Parameters<typeof arbeitstage>[2],
) => {
  const ergebnis = arbeitstage(stempel, SPAETER, einsaetze);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

describe("review S-505, round 5: call-outs as the same times stamped", () => {
  it("boundary: stamped Mo 12:00 – 18:00, call-out Di 3:00 – 4:00 (exactly 9 h later)", () => {
    const gestempelt = [kommen("2026-11-16T12:00+01:00"), gehen("2026-11-16T18:00+01:00")];
    const alsStempel = tage(
      [
        kommen("2026-11-16T12:00+01:00"),
        gehen("2026-11-16T18:00+01:00"),
        kommen("2026-11-17T03:00+01:00"),
        gehen("2026-11-17T04:00+01:00"),
      ],
      SPAETER,
    );
    const ergebnis = mitEinsaetzen(gestempelt, [
      { beginn: um("2026-11-17T03:00+01:00"), ende: um("2026-11-17T04:00+01:00") },
    ]);
    expect(alsTage(ergebnis)).toEqual(alsTage(alsStempel));
  });

  it("random cases over the October DST change", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const liste = spannen(zufall(seed));
      const stempel = liste.flatMap(({ beginn, ende }) => [
        { art: "kommen" as const, zeitpunkt: beginn },
        { art: "gehen" as const, zeitpunkt: ende },
      ]);
      const nurGestempelt = liste
        .filter((s) => !s.einsatz)
        .flatMap(({ beginn, ende }) => [
          { art: "kommen" as const, zeitpunkt: beginn },
          { art: "gehen" as const, zeitpunkt: ende },
        ]);
      const einsaetze = liste
        .filter((s) => s.einsatz)
        .map(({ beginn, ende }) => ({ beginn, ende }));
      const alsStempel = tage(stempel, SPAETER);
      // only where the same times stamped make complete shifts (no R-01 finding)
      if (alsStempel.some((tag) => tag.befunde.length > 0)) continue;
      const ist = mitEinsaetzen(nurGestempelt, einsaetze);
      expect({ seed, tage: alsTage(ist) }).toEqual({ seed, tage: alsTage(alsStempel) });
    }
  }, 60_000);
});
