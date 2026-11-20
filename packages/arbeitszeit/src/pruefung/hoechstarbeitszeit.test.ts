import { describe, expect, it } from "vitest";
import { hoechstarbeitszeit } from "./hoechstarbeitszeit.ts";
import { arbeit, kommen, pause, schicht, tage, um, weiter } from "./testhilfen.ts";

/*
 * docs/regeln.md, R-02 (cases taken literally), with the midnight and DST cases of the working day
 * (R-01, Grundbegriff "Arbeitstag"). Each day has a Ruhepause of 45 minutes from 11:00, so that the
 * working time is exactly the one the case names.
 */
const tagMitArbeitszeit = (minuten: number) => [
  kommen("2026-11-16T07:00+01:00"),
  pause("2026-11-16T11:00+01:00"),
  weiter("2026-11-16T11:45+01:00"),
  { art: "gehen" as const, zeitpunkt: um("2026-11-16T11:45+01:00") + (minuten - 240) * 60_000 },
];

const pruefe = (minuten: number) => {
  const ergebnis = hoechstarbeitszeit(tage(tagMitArbeitszeit(minuten)));
  expect(ergebnis.nichtHinterlegt).toEqual([]);
  return ergebnis.befunde;
};

describe("R-02: Höchstarbeitszeit am Tag", () => {
  it("erlaubt: 7:59 – no finding", () => {
    expect(pruefe(479)).toEqual([]);
  });

  it("Grenze: 8:00 – no finding („nicht überschreiten“)", () => {
    expect(pruefe(480)).toEqual([]);
  });

  it("Hinweis: 8:01 – Hinweis „über 8 h, Ausgleich nötig“", () => {
    expect(pruefe(481)).toEqual([
      {
        regel: "R-02",
        norm: "§ 3 Satz 2 ArbZG",
        schwere: "hinweis",
        art: "ueber_8h",
        tage: ["2026-11-16"],
        minuten: 481,
        ueber: 1,
      },
    ]);
  });

  it("Grenze: 10:00 – Hinweis („bis zu zehn Stunden“)", () => {
    expect(pruefe(600)).toEqual([
      expect.objectContaining({ schwere: "hinweis", art: "ueber_8h", minuten: 600, ueber: 120 }),
    ]);
  });

  it("Verstoß: 10:01 – Verstoß „über 10 h“", () => {
    expect(pruefe(601)).toEqual([
      {
        regel: "R-02",
        norm: "§ 3 Satz 2 ArbZG",
        schwere: "verstoss",
        art: "ueber_10h",
        tage: ["2026-11-16"],
        minuten: 601,
        ueber: 1,
      },
    ]);
  });
});

describe("R-02: the working day, midnight and DST", () => {
  it("adds up every shift that begins on the day, the one past midnight included", () => {
    const { befunde } = hoechstarbeitszeit(
      tage([
        ...schicht("2026-11-16T06:00+01:00", "2026-11-16T11:00+01:00"),
        ...schicht("2026-11-16T20:00+01:00", "2026-11-17T01:01+01:00"),
      ]),
    );
    expect(befunde).toEqual([
      expect.objectContaining({ art: "ueber_10h", tage: ["2026-11-16"], minuten: 601 }),
    ]);
  });

  it("counts a Sunday like any other day (§ 11 Abs. 2 ArbZG)", () => {
    const { befunde } = hoechstarbeitszeit(tage(arbeit("2026-11-22T08:00+01:00", 601)));
    expect(befunde).toEqual([expect.objectContaining({ art: "ueber_10h", tage: ["2026-11-22"] })]);
  });

  it("22:00 to 7:00 over 25.10.2026 is 10:00 of real time: a Hinweis, not a Verstoß", () => {
    const { befunde } = hoechstarbeitszeit(
      tage(schicht("2026-10-24T22:00+02:00", "2026-10-25T07:00+01:00")),
    );
    expect(befunde).toEqual([
      expect.objectContaining({ art: "ueber_8h", tage: ["2026-10-24"], minuten: 600, ueber: 120 }),
    ]);
  });

  it("22:00 to 7:00 over 28.03.2027 is 8:00 of real time: no finding", () => {
    const { befunde } = hoechstarbeitszeit(
      tage(schicht("2027-03-27T22:00+01:00", "2027-03-28T07:00+02:00")),
    );
    expect(befunde).toEqual([]);
  });

  it("judges an open shift only once it is closed (R-01 reports it)", () => {
    const stempel = [kommen("2026-11-16T07:00+01:00")];
    const { befunde } = hoechstarbeitszeit(tage(stempel, um("2026-11-17T12:00+01:00")));
    expect(befunde).toEqual([]);
  });

  it("names a day before the first rule version instead of judging it", () => {
    const ergebnis = hoechstarbeitszeit(tage(arbeit("2025-12-30T07:00+01:00", 700)));
    expect(ergebnis).toEqual({ befunde: [], nichtHinterlegt: ["2025-12-30"] });
  });
});
