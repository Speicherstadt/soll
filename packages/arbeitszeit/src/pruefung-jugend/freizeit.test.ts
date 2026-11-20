import { describe, expect, it } from "vitest";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import { freizeit } from "./freizeit.ts";
import { LEON, schicht, tage } from "./testhilfen.ts";

/* docs/regeln.md, R-18 (cases taken literally): work on Mo 16.11.2026 from 12:00, on Di until 12:00 */
const moDi = (ende: string, beginn: string): Stempelung[] => [
  ...schicht("2026-11-16T12:00+01:00", `2026-11-16T${ende}+01:00`),
  ...schicht(`2026-11-17T${beginn}+01:00`, "2026-11-17T12:00+01:00"),
];

describe("R-18: tägliche Freizeit", () => {
  it("erlaubt: 17:00 – 7:00 (14:00) – no finding", () => {
    expect(freizeit(tage(moDi("17:00", "07:00")), LEON)).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });

  it("Grenze: 19:00 – 7:00 (12:00) – no finding", () => {
    expect(freizeit(tage(moDi("19:00", "07:00")), LEON).befunde).toEqual([]);
  });

  it("Verstoß: 19:01 – 7:00 (11:59) – „Freizeit 11:59“", () => {
    expect(freizeit(tage(moDi("19:01", "07:00")), LEON).befunde).toEqual([
      {
        regel: "R-18",
        norm: "§ 13 JArbSchG",
        schwere: "verstoss",
        art: "freizeit_zu_kurz",
        tage: ["2026-11-16", "2026-11-17"],
        ruhe: {
          beginn: Date.parse("2026-11-16T19:01+01:00"),
          ende: Date.parse("2026-11-17T07:00+01:00"),
          minuten: 11 * 60 + 59,
        },
        mindestens: 12 * 60,
        fehlt: 1,
      },
    ]);
  });

  it("Herbst: Sa 24.10.2026 19:00 – So 6:00 (12:00 real time) – no finding", () => {
    const stempel = [
      ...schicht("2026-10-24T12:00+02:00", "2026-10-24T19:00+02:00"),
      ...schicht("2026-10-25T06:00+01:00", "2026-10-25T10:00+01:00"),
    ];
    expect(freizeit(tage(stempel), LEON).befunde).toEqual([]);
  });

  it("Frühjahr: Sa 27.3.2027 19:00 – So 7:00 (11:00 real time) – „Freizeit 11:00“", () => {
    const stempel = [
      ...schicht("2027-03-27T12:00+01:00", "2027-03-27T19:00+01:00"),
      ...schicht("2027-03-28T07:00+02:00", "2027-03-28T10:00+02:00"),
    ];
    // Leon is 18 by then; a younger apprentice
    expect(freizeit(tage(stempel), { ...LEON, geburtsdatum: "2010-01-01" }).befunde).toEqual([
      expect.objectContaining({ fehlt: 60, ruhe: expect.objectContaining({ minuten: 660 }) }),
    ]);
  });

  it("owes the 12 hours before the first shift on the 18th birthday, not after it", () => {
    const vorher = { ...LEON, geburtsdatum: "2008-11-17" };
    expect(freizeit(tage(moDi("19:01", "07:00")), vorher).befunde).toHaveLength(1);
    const danach = { ...LEON, geburtsdatum: "2008-11-16" };
    expect(freizeit(tage(moDi("19:01", "07:00")), danach).befunde).toEqual([]);
  });

  it("am selben Tag: Mo 0:00 – 4:00, Mo 14:00 – 19:00 (10:00) – „Freizeit 10:00“", () => {
    // two shifts 10 hours apart are two working days by the 9 hours of S-201, measured as in R-05
    const stempel = [
      ...schicht("2026-11-16T00:00+01:00", "2026-11-16T04:00+01:00"),
      ...schicht("2026-11-16T14:00+01:00", "2026-11-16T19:00+01:00"),
    ];
    expect(freizeit(tage(stempel), LEON).befunde).toEqual([
      expect.objectContaining({ fehlt: 120, ruhe: expect.objectContaining({ minuten: 600 }) }),
    ]);
  });
});
