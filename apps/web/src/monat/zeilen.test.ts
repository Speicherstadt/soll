import { describe, expect, it } from "vitest";
import { saldoText, vormonat, zeilenDesMonats } from "./zeilen.ts";

const ms = (text: string) => Date.parse(text);

describe("zeilenDesMonats", () => {
  it("reads first and last stamp, break and work of each day, with its findings", () => {
    const befund = {
      regel: "R-04",
      norm: "§ 4 ArbZG",
      schwere: "verstoss" as const,
      art: "ohne_pause",
      tage: ["2026-10-31"],
    };
    const zeilen = zeilenDesMonats(
      [
        {
          tag: "2026-10-06",
          stempel: [
            ["kommen", ms("2026-10-06T08:00:00+02:00")],
            ["pause_beginn", ms("2026-10-06T12:00:00+02:00")],
            ["pause_ende", ms("2026-10-06T12:30:00+02:00")],
            ["gehen", ms("2026-10-06T16:30:00+02:00")],
          ],
          modellMinuten: 480,
        },
        {
          tag: "2026-10-07",
          stempel: [],
          modellMinuten: null,
          abwesenheiten: [{ art: "urlaub", halb: true }],
        },
        {
          tag: "2026-10-31",
          stempel: [
            ["kommen", ms("2026-10-31T20:00:00+01:00")],
            ["gehen", ms("2026-11-01T04:00:00+01:00")],
          ],
          modellMinuten: 0,
        },
      ],
      [befund],
      ["2026-10-06"],
      ms("2026-11-20T09:00:00+01:00"),
    );
    expect(zeilen[0]).toEqual({
      tag: "2026-10-06",
      beginn: ms("2026-10-06T08:00:00+02:00"),
      ende: ms("2026-10-06T16:30:00+02:00"),
      pauseMinuten: 30,
      arbeitsMinuten: 480,
      sollMinuten: 480,
      befunde: [],
      geaendert: true,
      abwesenheiten: [],
      einsaetze: [],
      ausPlan: false,
    });
    expect(zeilen[1]).toMatchObject({
      beginn: null,
      ende: null,
      sollMinuten: null,
      geaendert: false,
      abwesenheiten: [{ art: "urlaub", halb: true }],
    });
    expect(zeilen[2]).toMatchObject({ arbeitsMinuten: 480, befunde: [befund] });
  });
});

describe("vormonat and saldoText", () => {
  it("takes the month before the running one in Berlin, also over the new year", () => {
    expect(vormonat(ms("2026-11-20T09:00:00+01:00"))).toBe("2026-10");
    expect(vormonat(ms("2026-12-31T23:30:00Z"))).toBe("2026-12");
    expect(vormonat(ms("2026-01-15T12:00:00Z"))).toBe("2025-12");
  });

  it("writes the balance with its sign", () => {
    expect(saldoText(208)).toBe("+3:28");
    expect(saldoText(-15)).toBe("-0:15");
    expect(saldoText(0)).toBe("+0:00");
  });
});

describe("zeilenDesMonats with call-outs and the Soll from the plan (S-505)", () => {
  it("adds the minutes of ended call-outs to the day and takes the planned Soll", () => {
    const [tag] = zeilenDesMonats(
      [
        {
          tag: "2026-10-25",
          stempel: [],
          modellMinuten: 480,
          planMinuten: 360,
          // the night the clocks go back: 1:30 (+02:00) to 2:30 (+01:00) are two real hours
          einsaetze: [
            [ms("2026-10-25T01:30:00+02:00"), ms("2026-10-25T02:30:00+01:00")],
            [ms("2026-10-25T05:00:00+01:00"), null],
          ],
        },
      ],
      [],
      [],
      ms("2026-10-26T12:00:00+01:00"),
    );
    expect(tag).toMatchObject({ arbeitsMinuten: 120, sollMinuten: 360, ausPlan: true });
    expect(tag?.einsaetze).toHaveLength(2);
  });
});
