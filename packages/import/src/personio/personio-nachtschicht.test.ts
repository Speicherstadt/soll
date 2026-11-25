import { describe, expect, it } from "vitest";
import weber from "./fixtures/weber-personio.json" with { type: "json" };
import { personioAbzugText, personioLesen } from "./index.ts";

// Review S-704: a night shift on the last day of the fetch whose break lies after midnight.
// Personio keeps a day as WORK and BREAK periods (n8n-nodes-personio-hr,
// AttendancePeriodDescription.ts); BAULISTE S-704: "die Pausen werden aus der Arbeit
// herausgenommen". The break begins on the next day, outside the period, so neither the fetch
// (`start.date_time.lte` = bis T23:59:59) nor the reader (begin day in the head's period) keeps it.
const id = (n: number) => `a1b2c3d4-0000-4000-8000-${String(n).padStart(12, "0")}`;
const periode = (n: number, typ: string, start: string, end: string) => ({
  id: id(n),
  person: { id: "1002" },
  type: typ,
  start: { date_time: start },
  end: { date_time: end },
  approval: { status: "CONFIRMED" },
});

const minutenAus = (von: string, bis: string, arbeit: string[], pause: string[]) => {
  const text = personioAbzugText({
    von,
    bis,
    person: weber.persons,
    absence_type: weber.absence_types,
    absence: [],
    attendance: [
      periode(1, "WORK", arbeit[0] as string, arbeit[1] as string),
      periode(2, "BREAK", pause[0] as string, pause[1] as string),
    ],
  });
  const { daten } = personioLesen(new TextEncoder().encode(text));
  return daten.zeiten.reduce((summe, z) => summe + ((z.ende - z.beginn + 1440) % 1440), 0);
};

describe("review S-704: night shift on the last day of the period", () => {
  it("control: inside the period the break after midnight is taken out", () => {
    expect(
      minutenAus(
        "2026-09-01",
        "2026-09-30",
        ["2026-09-29T22:00:00", "2026-09-30T06:00:00"],
        ["2026-09-30T01:00:00", "2026-09-30T01:30:00"],
      ),
    ).toBe(450);
  });

  it("takes the break after midnight out of the work that began in the period", () => {
    const text = personioAbzugText({
      von: "2026-09-01",
      bis: "2026-09-30",
      person: weber.persons,
      absence_type: weber.absence_types,
      absence: [],
      attendance: [
        periode(1, "WORK", "2026-09-30T22:00:00", "2026-10-01T06:00:00"),
        periode(2, "BREAK", "2026-10-01T01:00:00", "2026-10-01T01:30:00"),
      ],
    });
    const { daten } = personioLesen(new TextEncoder().encode(text));
    // 8 h recorded minus a 30 min break: 7 h 30 min of work, never 8 h
    const minuten = daten.zeiten.reduce(
      (summe, z) => summe + ((z.ende - z.beginn + 1440) % 1440),
      0,
    );
    expect(minuten).toBe(450);
  });

  it("takes no work that begins after the period, and the next period no break without its work", () => {
    const lesen = (von: string, bis: string) =>
      personioLesen(
        new TextEncoder().encode(
          personioAbzugText({
            von,
            bis,
            person: weber.persons,
            absence_type: weber.absence_types,
            absence: [],
            attendance: [
              periode(1, "WORK", "2026-09-30T22:00:00", "2026-10-01T06:00:00"),
              periode(2, "BREAK", "2026-10-01T01:00:00", "2026-10-01T01:30:00"),
              periode(3, "WORK", "2026-10-01T08:00:00", "2026-10-01T12:00:00"),
            ],
          }),
        ),
      ).daten.zeiten.map((z) => [z.tag, z.beginn, z.ende]);
    expect(lesen("2026-09-01", "2026-09-30")).toEqual([
      ["2026-09-30", 1320, 60],
      // the piece after the break is a span of its own, on the day it begins (as S-703, S-705)
      ["2026-10-01", 90, 360],
    ]);
    expect(lesen("2026-10-01", "2026-10-31")).toEqual([["2026-10-01", 480, 720]]);
  });
});
