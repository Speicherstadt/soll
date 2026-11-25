import { describe, expect, it } from "vitest";
import { schicht } from "../dienstplan/testhilfen.ts";
import { zeitpunktInBerlin } from "../kalender/zeit.ts";
import { planBefunde } from "./planpruefung.ts";
import { planTage } from "./plantage.ts";

/*
 * Review S-505 round 6. § 9 Abs. 1 ArbZG counts Sunday from 0 to 24 Uhr; docs/regeln.md R-12
 * „Im Plan“: a finding that names only past days belongs to the time records, not to the plan.
 * A planned shift Mo 8:00 – 14:00 has no minute on Sunday and must not carry R-07 for a call-out
 * of the past Sunday, the same as it does not when the same Sunday times were worked (R-29).
 */
const HEUTE = "2026-11-23";
const SO = "2026-11-22";
const um = (tag: string, uhrzeit: string): number => {
  const [h = 0, m = 0] = uhrzeit.split(":").map(Number);
  return zeitpunktInBerlin(tag, h * 60 + m) as number;
};
const mo = schicht(HEUTE, "08:00", "14:00");
const pruefe = (weiteres: object) =>
  planBefunde({
    schichten: [mo],
    rufdienste: [],
    ist: [],
    heute: HEUTE,
    standort: { land: "HH" },
    betrieb: {},
    person: {},
    mitteilungAm: () => HEUTE,
    ...weiteres,
  } as Parameters<typeof planBefunde>[0]).befunde.map((b) => [
    b.regel,
    b.art,
    b.tage,
    b.schichtIds,
  ]);

describe("review S-505 r6: R-07 of a past Sunday at a planned Monday shift", () => {
  it("the same Sunday times worked put no R-07 on the Monday plan", () => {
    const ist = planTage([schicht(SO, "23:00", "00:30")], [], SO).tage;
    expect(pruefe({ ist }).filter(([regel]) => regel === "R-07")).toEqual([]);
  });
  it("a call-out So 23:00 – Mo 0:30 puts no R-07 on the planned Mo 8:00 – 14:00", () => {
    const einsaetze = [{ beginn: um(SO, "23:00"), ende: um(HEUTE, "00:30") }];
    expect(pruefe({ einsaetze }).filter(([regel]) => regel === "R-07")).toEqual([]);
  });
});
