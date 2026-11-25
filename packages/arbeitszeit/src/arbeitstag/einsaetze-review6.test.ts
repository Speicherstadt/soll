import { describe, expect, it } from "vitest";
import { hoechstarbeitszeit } from "../pruefung/hoechstarbeitszeit.ts";
import { ruhepausen } from "../pruefung/ruhepausen.ts";
import { type Arbeitstag, arbeitstage } from "./arbeitstag.ts";
import type { Einsatzspanne } from "./einsaetze.ts";
import type { Stempelung } from "./stempelungen.ts";
import { um } from "./testhilfen.ts";

/*
 * Review S-505 round 6: call-outs that OVERLAP stamped work (which the builder's property test never
 * generates) must give what the union of the times stamped gives (R-12 "Was zugleich gestempelt
 * ist, zählt einmal"; R-29). Gaps concentrated around 15 min and 9 h, over both DST changes.
 */
const MINUTE = 60_000;
const zufall = (seed: number) => {
  let zustand = seed;
  return () => {
    zustand = (zustand + 0x6d2b79f5) | 0;
    let t = Math.imul(zustand ^ (zustand >>> 15), zustand | 1);
    t = t ^ (t + Math.imul(t ^ (t >>> 7), t | 61));
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const luecke = (r: () => number) => {
  const x = r();
  if (x < 0.3) return (13 + Math.floor(r() * 5)) * MINUTE; // 13..17 min
  if (x < 0.6) return (538 + Math.floor(r() * 5)) * MINUTE; // ~9 h
  return (Math.floor(r() * 14 * 60) + 1) * MINUTE;
};
type Spanne = { beginn: number; ende: number };
const folge = (r: () => number, start: number, n: number): Spanne[] => {
  const liste: Spanne[] = [];
  let t = start;
  for (let i = 0; i < n; i++) {
    t += luecke(r);
    const ende = t + (Math.floor(r() * 5 * 60) + 1) * MINUTE;
    liste.push({ beginn: t, ende });
    t = ende;
  }
  return liste;
};
const vereint = (alle: Spanne[]): Spanne[] => {
  const out: Spanne[] = [];
  for (const s of [...alle].sort((a, b) => a.beginn - b.beginn)) {
    const l = out.at(-1);
    if (l && s.beginn <= l.ende) l.ende = Math.max(l.ende, s.ende);
    else out.push({ ...s });
  }
  return out;
};
const paare = (liste: Spanne[]): Stempelung[] =>
  liste.flatMap(({ beginn, ende }) => [
    { art: "kommen" as const, zeitpunkt: beginn },
    { art: "gehen" as const, zeitpunkt: ende },
  ]);
const lies = (stempel: Stempelung[], einsaetze: Einsatzspanne[], jetzt: number) => {
  const e = arbeitstage(stempel, jetzt, einsaetze);
  if (!e.ok) throw new Error(e.grund);
  return e.wert;
};
const vergleich = (tage: readonly Arbeitstag[]) => ({
  tage: tage.map((tag) => ({
    ...tag,
    schichten: tag.schichten.map(({ einsaetze: _, ...s }) => s),
  })),
  hoechst: hoechstarbeitszeit(tage).befunde,
  pausen: ruhepausen(tage).befunde,
});

/** stamped with breaks: a gap under 9 h between stamped stretches is stamped as a break */
const mitPausen = (liste: Spanne[]): Stempelung[] =>
  liste.flatMap(({ beginn, ende }, i): Stempelung[] => {
    const vor = liste[i - 1];
    const nach = liste[i + 1];
    const pauseVor = vor !== undefined && beginn - vor.ende < 540 * MINUTE;
    const pauseNach = nach !== undefined && nach.beginn - ende < 540 * MINUTE;
    return [
      { art: pauseVor ? "pause_ende" : "kommen", zeitpunkt: beginn },
      { art: pauseNach ? "pause_beginn" : "gehen", zeitpunkt: ende },
    ];
  });

describe("review S-505 r6: stamped breaks overlapped by call-outs", () => {
  for (const [name, start] of [
    ["Herbst", um("2026-10-23T00:00+02:00")],
    ["Frühjahr", um("2026-03-27T00:00+01:00")],
  ] as const)
    it(name, () => {
      for (let seed = 1; seed <= 500; seed++) {
        const r = zufall(seed);
        const gestempelt = folge(r, start, 2 + Math.floor(r() * 5));
        const einsaetze = folge(r, start, 1 + Math.floor(r() * 4));
        const jetzt = start + 12 * 24 * 60 * MINUTE;
        const ohne = vergleich(lies(mitPausen(gestempelt), [], jetzt));
        const ohneKG = vergleich(lies(paare(gestempelt), [], jetzt));
        // precondition: breaks stamped and Gehen/Kommen give the same without call-outs
        if (JSON.stringify(ohne) !== JSON.stringify(ohneKG)) continue;
        const alsStempel = lies(paare(vereint([...gestempelt, ...einsaetze])), [], jetzt);
        const mit = lies(mitPausen(gestempelt), einsaetze, jetzt);
        expect({ seed, ...vergleich(mit) }).toEqual({ seed, ...vergleich(alsStempel) });
      }
    }, 60_000);
});

describe("review S-505 r6: overlapping call-outs as the union stamped", () => {
  for (const [name, start] of [
    ["Herbst", um("2026-10-23T00:00+02:00")],
    ["Frühjahr", um("2026-03-27T00:00+01:00")],
  ] as const)
    it(name, () => {
      for (let seed = 1; seed <= 500; seed++) {
        const r = zufall(seed);
        const gestempelt = folge(r, start, 2 + Math.floor(r() * 5));
        const einsaetze = folge(r, start, 1 + Math.floor(r() * 4));
        // keep only call-outs that do not overlap each other (the server refuses those)
        const jetzt = start + 12 * 24 * 60 * MINUTE;
        const alsStempel = lies(paare(vereint([...gestempelt, ...einsaetze])), [], jetzt);
        const mit = lies(paare(gestempelt), einsaetze, jetzt);
        expect({ seed, ...vergleich(mit) }).toEqual({ seed, ...vergleich(alsStempel) });
      }
    }, 60_000);
});
