import { tagInBerlin } from "@soll/arbeitszeit";
import { describe, expect, it } from "vitest";
import { type LohnAufzeichnung, type LohnmonatEingabe, lohnmonat } from "./lohnmonat.ts";
import { HAMBURG, monatsTage, stundenModell } from "./testdaten.ts";

/*
 * R-29 by construction (reviews of S-505): random call-outs give payroll the same hours and
 * surcharges as the same times stamped (§ 3b EStG with the 40 % from 0 to 4 Uhr after a start
 * before 0 Uhr, Sundays included). Stretches with gaps from a minute to 14 hours in June 2026.
 */

const MINUTE = 60_000;
const START = Date.parse("2026-06-03T00:00:00+02:00");
const modelle = [
  stundenModell(2000, { zuschlagssaetze: { nacht: 2500, nacht0bis4: 4000, sonntag: 5000 } }),
];
const MO_FR = [480, 480, 480, 480, 480, 0, 0];

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

type Strecke = { beginn: number; ende: number; einsatz: boolean };

const strecken = (r: () => number): Strecke[] => {
  const liste: Strecke[] = [];
  let t = START;
  for (let i = 0; i < 8; i++) {
    t += (Math.floor(r() * 14 * 60) + 1) * MINUTE;
    const ende = t + (Math.floor(r() * 6 * 60) + 1) * MINUTE;
    liste.push({ beginn: t, ende, einsatz: r() < 0.5 });
    t = ende;
  }
  return liste;
};

/** The month with the stretches: stamped, or as call-outs where they are, each on its first day */
const juni = (liste: readonly Strecke[], alleGestempelt: boolean): LohnmonatEingabe => {
  const tage: LohnAufzeichnung[] = monatsTage("2026-06", MO_FR, [], "+02:00").map((tag) => {
    const am = liste.filter((strecke) => tagInBerlin(strecke.beginn) === tag.tag);
    const gestempelt = am.filter((strecke) => alleGestempelt || !strecke.einsatz);
    const einsaetze = am.filter((strecke) => !alleGestempelt && strecke.einsatz);
    return {
      ...tag,
      stempel: gestempelt.flatMap(
        ({ beginn, ende }) =>
          [
            ["kommen", beginn],
            ["gehen", ende],
          ] as const,
      ),
      ...(einsaetze.length > 0
        ? { einsaetze: einsaetze.map(({ beginn, ende }) => [beginn, ende] as const) }
        : {}),
    };
  });
  return {
    nutzerId: "sandra",
    monat: "2026-06",
    tage,
    gegeneintraege: [],
    modelle,
    standort: HAMBURG,
  };
};

const posten = (eingabe: LohnmonatEingabe) => {
  const ergebnis = lohnmonat(eingabe);
  if (!ergebnis.ok) throw new Error(JSON.stringify(ergebnis.probleme));
  return ergebnis.wert.posten;
};

describe("payroll of call-outs as the same times stamped (R-29)", () => {
  it("gives the same hours and surcharges for random call-outs", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const liste = strecken(zufall(seed));
      expect({ seed, posten: posten(juni(liste, false)) }).toEqual({
        seed,
        posten: posten(juni(liste, true)),
      });
    }
  }, 60_000);
});
