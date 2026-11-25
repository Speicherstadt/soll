import { describe, expect, it } from "vitest";
import { hoechstarbeitszeit } from "../pruefung/hoechstarbeitszeit.ts";
import { ruhepausen } from "../pruefung/ruhepausen.ts";
import { type Arbeitstag, arbeitstage } from "./arbeitstag.ts";
import type { Einsatzspanne } from "./einsaetze.ts";
import type { Stempelung } from "./stempelungen.ts";
import { um } from "./testhilfen.ts";

/*
 * R-29 by construction (reviews of S-505): random call-outs give the same working days, shifts,
 * breaks, Ist and findings (R-01, R-02, R-04) as the same times stamped. Stretches of work with
 * gaps from a minute to 14 hours over both DST changes; stamped neighbours sometimes joined by a
 * stamped break, sometimes a Kommen without its Gehen, the last call-out sometimes still running.
 * The rest (R-05) is the one rule that reads call-outs apart (R-12) and is left out here.
 */

const MINUTE = 60_000;

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

type Strecke = { beginn: number; ende: number | null; einsatz: boolean; pauseDavor: boolean };

const strecken = (r: () => number, start: number): Strecke[] => {
  const liste: Strecke[] = [];
  let t = start;
  const anzahl = 2 + Math.floor(r() * 7);
  for (let i = 0; i < anzahl; i++) {
    t += (Math.floor(r() * 14 * 60) + 1) * MINUTE;
    const ende = t + (Math.floor(r() * 6 * 60) + 1) * MINUTE;
    const einsatz = r() < 0.5;
    const vorher = liste.at(-1);
    const pauseDavor = !einsatz && vorher?.einsatz === false && r() < 0.4;
    const offen = i === anzahl - 1 && r() < 0.2;
    liste.push({ beginn: t, ende: offen ? null : ende, einsatz, pauseDavor });
    t = ende;
  }
  return liste;
};

/** The same times stamped: a break between two stamped stretches when it was stamped as one */
const gestempelt = (liste: readonly Strecke[], alle: boolean): Stempelung[] =>
  liste.flatMap((strecke, index): Stempelung[] => {
    if (!alle && strecke.einsatz) return [];
    const naechste = liste[index + 1];
    const inPause = naechste?.pauseDavor === true;
    return [
      { art: strecke.pauseDavor ? "pause_ende" : "kommen", zeitpunkt: strecke.beginn },
      ...(strecke.ende === null
        ? []
        : [{ art: inPause ? "pause_beginn" : "gehen", zeitpunkt: strecke.ende } as Stempelung]),
    ];
  });

const lies = (stempel: Stempelung[], einsaetze: Einsatzspanne[], jetzt: number) => {
  const ergebnis = arbeitstage(stempel, jetzt, einsaetze);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

/** What is compared: the days without the marks of call-outs, which only the rest reads */
const ohneMarken = (tage: readonly Arbeitstag[]) =>
  tage.map((tag) => ({
    ...tag,
    schichten: tag.schichten.map(({ einsaetze: _, ...schicht }) => schicht),
  }));

const vergleich = (tage: readonly Arbeitstag[]) => ({
  tage: ohneMarken(tage),
  hoechst: hoechstarbeitszeit(tage).befunde,
  pausen: ruhepausen(tage).befunde,
});

describe("call-outs as the same times stamped (R-29)", () => {
  for (const [name, start] of [
    ["Herbst", um("2026-10-23T00:00+02:00")],
    ["Frühjahr", um("2026-03-27T00:00+01:00")],
  ] as const)
    it(`gives the same days, shifts, Ist and findings: ${name}`, () => {
      for (let seed = 1; seed <= 400; seed++) {
        const liste = strecken(zufall(seed), start);
        const einsaetze = liste
          .filter((strecke) => strecke.einsatz)
          .map(({ beginn, ende }) => ({ beginn, ende }));
        const jetzt = start + 10 * 24 * 60 * MINUTE;
        const alsStempel = lies(gestempelt(liste, true), [], jetzt);
        const mitEinsatz = lies(gestempelt(liste, false), einsaetze, jetzt);
        expect({ seed, ...vergleich(mitEinsatz) }).toEqual({ seed, ...vergleich(alsStempel) });
      }
    }, 60_000);
});
