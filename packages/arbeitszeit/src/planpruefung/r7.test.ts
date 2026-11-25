import { describe, expect, it } from "vitest";
import { arbeitstage } from "../arbeitstag/arbeitstag.ts";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import { rufdienst, schicht } from "../dienstplan/testhilfen.ts";
import { zeitpunktInBerlin } from "../kalender/zeit.ts";
import { planBefunde } from "./planpruefung.ts";

/*
 * Review S-505 round 7 (R-29; docs/regeln.md R-12 „Im Plan“; § 9 Abs. 1, § 4 ArbZG).
 */
const HEUTE = "2026-11-23"; // Monday
const SO = "2026-11-22";
const um = (tag: string, uhrzeit: string): number => {
  const [h = 0, m = 0] = uhrzeit.split(":").map(Number);
  return zeitpunktInBerlin(tag, h * 60 + m) as number;
};
const kurz = (weiteres: object) =>
  planBefunde({
    rufdienste: [],
    ist: [],
    heute: HEUTE,
    standort: { land: "HH" },
    betrieb: {},
    person: {},
    mitteilungAm: () => HEUTE,
    ...weiteres,
  } as unknown as Parameters<typeof planBefunde>[0]).befunde.map((b) => [
    b.regel,
    b.art,
    b.tage,
    b.schichtIds,
  ]);
const ist = (stempel: Stempelung[], jetzt: number) => {
  const e = arbeitstage(stempel, jetzt);
  if (!e.ok) throw new Error(e.grund);
  return e.wert;
};
const paar = (tag: string, von: string, tagBis: string, bis: string): Stempelung[] => [
  { art: "kommen", zeitpunkt: um(tag, von) },
  { art: "gehen", zeitpunkt: um(tagBis, bis) },
];

describe("r7 A: a planned duty later in the week brings R-07 of the past Sunday back", () => {
  const mo = schicht(HEUTE, "08:00", "14:00");
  // Wednesday 18:00 – 6:00 with 30 min reaction time: not working time, nothing to do with Monday
  const mi = rufdienst("2026-11-25", "18:00", "06:00", { reaktionMinuten: 30 });
  const jetzt = um(HEUTE, "07:00");
  // S-505 deferred: open defect, see BAULISTE Zurückgestellt
  it.fails("Sunday 23:00 – 0:30 worked: no R-07 at the Monday shift, duty or not", () => {
    const tage = ist(paar(SO, "23:00", HEUTE, "00:30"), jetzt);
    expect(kurz({ schichten: [mo], ist: tage }).filter(([r]) => r === "R-07")).toEqual([]);
    expect(
      kurz({ schichten: [mo], ist: tage, rufdienste: [mi] }).filter(([r]) => r === "R-07"),
    ).toEqual([]);
  });
  // S-505 deferred: open defect, see BAULISTE Zurückgestellt
  it.fails("call-out Sunday 23:00 – 0:30: no R-07 at the Monday shift, duty or not", () => {
    const einsaetze = [{ beginn: um(SO, "23:00"), ende: um(HEUTE, "00:30") }];
    expect(kurz({ schichten: [mo], einsaetze }).filter(([r]) => r === "R-07")).toEqual([]);
    expect(
      kurz({ schichten: [mo], einsaetze, rufdienste: [mi] }).filter(([r]) => r === "R-07"),
    ).toEqual([]);
  });
});

describe("r7 B: an old shift without Gehen and a call-out swallow the planned shift's findings", () => {
  // Fri 21:43 – Sun 1:15 stamped in pieces under 9 h apart: one shift that hits 24 h (R-01 gehen_fehlt)
  const stempel = [
    ...paar("2026-11-20", "21:43", "2026-11-20", "22:52"),
    ...paar("2026-11-21", "01:30", "2026-11-21", "06:27"),
    ...paar("2026-11-21", "13:33", "2026-11-21", "16:42"),
    ...paar("2026-11-21", "21:22", SO, "01:15"),
  ];
  const jetzt = um(HEUTE, "01:30");
  // Monday 3:31 – 9:44 without a break: § 4 ArbZG (R-04), whatever happened last week
  const mo = schicht(HEUTE, "03:31", "09:44");
  const einsatz = { beginn: um("2026-11-20", "05:09"), ende: um("2026-11-20", "10:18") };
  const r04 = (l: unknown[][]) => l.filter(([r]) => r === "R-04");
  it("the same Friday times stamped keep R-04 at the Monday shift", () => {
    const tage = ist([...paar("2026-11-20", "05:09", "2026-11-20", "10:18"), ...stempel], jetzt);
    expect(r04(kurz({ schichten: [mo], ist: tage }))).toHaveLength(2);
  });
  // S-505 deferred: open defect, see BAULISTE Zurückgestellt
  it.fails("as a call-out, R-04 stays at the Monday shift", () => {
    const tage = ist(stempel, jetzt);
    expect(r04(kurz({ schichten: [mo], ist: tage, einsaetze: [einsatz] }))).toHaveLength(2);
  });
});
