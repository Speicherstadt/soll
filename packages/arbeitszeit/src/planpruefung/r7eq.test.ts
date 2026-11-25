import { describe, expect, it } from "vitest";
import { arbeitstage } from "../arbeitstag/arbeitstag.ts";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import type { PlanSchicht } from "../dienstplan/typen.ts";
import { schichtZeiten } from "../dienstplan/zeiten.ts";
import { tagInBerlin, zeitpunktInBerlin } from "../kalender/zeit.ts";
import { planBefunde } from "./planpruefung.ts";

const MIN = 60_000;
const zufall = (seed: number) => {
  let z = seed;
  return () => {
    z = (z + 0x6d2b79f5) | 0;
    let t = Math.imul(z ^ (z >>> 15), z | 1);
    t = t ^ (t + Math.imul(t ^ (t >>> 7), t | 61));
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
type S = { beginn: number; ende: number };
const paare = (l: S[]): Stempelung[] =>
  [...l]
    .sort((a, b) => a.beginn - b.beginn)
    .flatMap(({ beginn, ende }) => [
      { art: "kommen" as const, zeitpunkt: beginn },
      { art: "gehen" as const, zeitpunkt: ende },
    ]);
const lies = (st: Stempelung[], jetzt: number) => {
  const e = arbeitstage(st, jetzt);
  if (!e.ok) throw new Error(e.grund);
  return e.wert;
};
const RUHE = new Set(["R-05", "R-12"]);

for (const JETZT_H of [1.5, 10])
  for (const [name, HEUTE] of [
    ["Mo", "2026-11-23"],
    ["Herbst", "2026-10-26"],
    ["Frühjahr", "2026-03-30"],
  ] as const)
    describe(`r7 ${name} ${JETZT_H}h: past call-outs vs the same times stamped`, () => {
      it("same plan findings at planned shifts (rest rules aside)", () => {
        const ab = zeitpunktInBerlin(HEUTE, 0) as number;
        const jetzt = ab + JETZT_H * 60 * MIN;
        const fehler: unknown[] = [];
        for (let seed = 1; seed <= 400; seed++) {
          const r = zufall(seed);
          // past call-outs: last 3 days, ending before now (some cross into today)
          const einsaetze: S[] = [];
          const gestempelt: S[] = [];
          let t = ab - 3 * 24 * 60 * MIN + Math.floor(r() * 600) * MIN;
          while (true) {
            const ende = t + (Math.floor(r() * 300) + 10) * MIN;
            if (ende > jetzt) break;
            (r() < 0.5 ? einsaetze : gestempelt).push({ beginn: t, ende });
            t = ende + (Math.floor(r() * 900) + 20) * MIN;
            if (t >= ab) break;
          }
          if (einsaetze.length === 0) continue;
          // planned shifts today and the two days after
          const schichten: PlanSchicht[] = [];
          let n = 0;
          for (let d = 0; d < 3; d++) {
            if (r() < 0.25) continue;
            const tag = tagInBerlin(ab + d * 24 * 60 * MIN + 12 * 60 * MIN);
            const von = (d === 0 ? JETZT_H * 60 + 30 : 0) + Math.floor(r() * 14 * 60);
            const z = schichtZeiten(tag, von, von + 60 + Math.floor(r() * 11 * 60));
            if (!z) continue;
            n += 1;
            schichten.push({
              schichtId: `p${n}`,
              standortId: "elbe",
              tag,
              ...z,
              pauseMinuten: r() < 0.5 ? 0 : 45,
              rolle: "S",
              nutzerId: "x",
            });
          }
          if (schichten.length === 0) continue;
          const basis = {
            schichten,
            rufdienste: [],
            heute: HEUTE,
            standort: { land: "HH" as const },
            betrieb: {},
            person: {},
            mitteilungAm: () => HEUTE,
          };
          const kurz = (b: ReturnType<typeof planBefunde>) =>
            b.befunde.map((x) => [x.regel, x.art, x.tage, x.schichtIds].join("|")).sort();
          const istG = lies(paare(gestempelt), jetzt);
          if (
            istG.some((t) => t.schichten.some((x) => x.ende === null || x.ende === undefined)) ||
            istG.some((t) => t.schichten.length === 0)
          )
            continue;
          const alsIst = kurz(
            planBefunde({
              ...basis,
              ist: lies(paare([...einsaetze, ...gestempelt]), jetzt),
            } as never),
          );
          const alsEinsatz = kurz(
            planBefunde({ ...basis, ist: lies(paare(gestempelt), jetzt), einsaetze } as never),
          );
          const ohneRuhe = (l: string[]) => l.filter((x) => !RUHE.has(x.split("|")[0] as string));
          if (JSON.stringify(ohneRuhe(alsIst)) !== JSON.stringify(ohneRuhe(alsEinsatz)))
            fehler.push({
              seed,
              einsaetze: einsaetze.map((e) => [
                new Date(e.beginn).toISOString(),
                new Date(e.ende).toISOString(),
              ]),
              schichten: schichten.map((s) => [
                s.schichtId,
                new Date(s.beginn).toISOString(),
                new Date(s.ende).toISOString(),
              ]),
              alsIst,
              alsEinsatz,
            });
          // a rest violation stamped must be at least an R-12 finding at the same shift (R-29)
          for (const x of alsIst.filter((x) => x.startsWith("R-05"))) {
            const ids = x.split("|")[3];
            if (
              !alsEinsatz.some(
                (y) => RUHE.has(y.split("|")[0] as string) && y.split("|")[3] === ids,
              )
            )
              fehler.push({ seed, ruhe: x, alsEinsatz });
          }
        }
        expect(fehler.slice(0, 1)).toEqual([]);
      }, 120_000);
    });
