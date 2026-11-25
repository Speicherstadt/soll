import { arbeitstage, ruhepausen, type Stempelung } from "@soll/arbeitszeit";
import { describe, expect, it } from "vitest";
import { schichtplanerAbzugText, schichtplanerLesen } from "./index.ts";
import { papershiftAbzug } from "./papershift.ts";

/*
 * Review S-706: Papershift knows only the length of a break (`break_duration`, 1800 s = 30 min).
 * Soll lays it in the middle of the session; a session that begins on a second other than :00
 * must not lose a minute of that break, or § 4 Satz 1 ArbZG (30 min after more than 6 hours)
 * reports a break the employee took as too short.
 */
/** The working days of stamps, as the tests of packages/arbeitszeit build them (testhilfen.ts) */
const tage = (stempel: Stempelung[]) => {
  const ergebnis = arbeitstage(stempel, Date.parse("2030-01-01T00:00:00Z"));
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

const leer = { users: [{ id: 1, name: "Tom Becker" }], absenceTypes: [], absences: [] };

describe("review: Papershift break_duration in the middle", () => {
  it("keeps the whole 30 minutes when the session starts at 08:00:30", () => {
    const abzug = papershiftAbzug(
      {
        ...leer,
        workingSessions: [
          {
            id: 7,
            user_id: 1,
            starts_at: "2026-09-01T08:00:30+02:00",
            ends_at: "2026-09-01T16:30:30+02:00",
            break_duration: 1800,
          },
        ],
      },
      { von: "2026-09-01", bis: "2026-09-30" },
    );
    const gelesen = schichtplanerLesen("papershift")(
      new TextEncoder().encode(schichtplanerAbzugText(abzug)),
    );
    const [a, b] = gelesen.daten.zeiten;
    expect(gelesen.daten.zeiten).toHaveLength(2);
    // the gap between the two blocks is the break the employee took
    expect((b?.beginn ?? 0) - (a?.ende ?? 0)).toBe(30);
  });

  it("raises no § 4 finding for those stamps", () => {
    const abzug = papershiftAbzug(
      {
        ...leer,
        workingSessions: [
          {
            id: 7,
            user_id: 1,
            starts_at: "2026-09-01T08:00:30+02:00",
            ends_at: "2026-09-01T16:30:30+02:00",
            break_duration: 1800,
          },
        ],
      },
      { von: "2026-09-01", bis: "2026-09-30" },
    );
    const gelesen = schichtplanerLesen("papershift")(
      new TextEncoder().encode(schichtplanerAbzugText(abzug)),
    );
    const tagBeginn = Date.parse("2026-09-01T00:00:00+02:00");
    const stempel = gelesen.daten.zeiten.flatMap((z) => [
      { art: "kommen" as const, zeitpunkt: tagBeginn + z.beginn * 60_000 },
      { art: "gehen" as const, zeitpunkt: tagBeginn + z.ende * 60_000 },
    ]);
    expect(ruhepausen(tage(stempel)).befunde).toEqual([]);
  });
});
