import { describe, expect, it } from "vitest";
import { einTag, rechne, saetzeVon, schicht, stundenlohn } from "./testhilfen.ts";

const um = (text: string) => Date.parse(text);

/*
 * § 3b Abs. 3 EStG: „Wenn die Nachtarbeit vor 0 Uhr aufgenommen wird“ – Soll asks whether the shift
 * worked between 20 Uhr and 0 Uhr of the evening before (docs/plan.md, Entscheidungen, "Zuschläge").
 */
describe("Nachtarbeit vor 0 Uhr aufgenommen", () => {
  it("Beginn So 19:00 (vor der Nachtzeit), Arbeit bis Mo 2:00 – 0 bis 2 Uhr 40 % + 50 %", () => {
    const tag = einTag(
      rechne(schicht("2026-11-15T19:00+01:00", "2026-11-16T02:00+01:00"), stundenlohn(2000), {}),
    );
    expect(saetzeVon(tag).map((s) => [s.von, s.steuerfreiProzent])).toEqual([
      ["19:00", 50],
      ["20:00", 75],
      ["00:00", 90],
    ]);
  });

  it("Ruhepause über Mitternacht: So 22:00 – 23:45, Pause bis 0:30, Arbeit bis 3:00 – 0:30 bis 3 Uhr 90 %", () => {
    const stempel = [
      { art: "kommen" as const, zeitpunkt: um("2026-11-15T22:00+01:00") },
      { art: "pause_beginn" as const, zeitpunkt: um("2026-11-15T23:45+01:00") },
      { art: "pause_ende" as const, zeitpunkt: um("2026-11-16T00:30+01:00") },
      { art: "gehen" as const, zeitpunkt: um("2026-11-16T03:00+01:00") },
    ];
    const tag = einTag(rechne(stempel, stundenlohn(2000), {}));
    expect(saetzeVon(tag).map((s) => [s.von, s.minuten, s.steuerfreiProzent])).toEqual([
      ["22:00", 105, 75],
      ["00:30", 150, 90],
    ]);
  });

  it("Schicht vor 0 Uhr ohne Nachtarbeit davor: So 18:00 – 19:30 und Mo 0:30 – 3:00 – nur 25 %", () => {
    const stempel = [
      ...schicht("2026-11-15T18:00+01:00", "2026-11-15T19:30+01:00"),
      ...schicht("2026-11-16T00:30+01:00", "2026-11-16T03:00+01:00"),
    ];
    const tag = einTag(rechne(stempel, stundenlohn(2000), {}));
    expect(saetzeVon(tag).map((s) => [s.von, s.steuerfreiProzent])).toEqual([
      ["18:00", 50],
      ["00:30", 25],
    ]);
  });
});
