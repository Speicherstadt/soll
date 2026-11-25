import { describe, expect, it } from "vitest";
import weber from "./fixtures/weber-kimai.json" with { type: "json" };
import { kimaiAbzugText, kimaiLesen } from "./index.ts";

// Review S-705: BAULISTE.md S-705 "Zeiten": a block from 24 hours and an instant in the hour that
// comes twice in October are refused with their line; "Aus jeder übernommenen Zeitbuchung mit
// Projekt wird eine Buchung" – a refused timesheet must not become a booking of project time.
const zeit = (id: number, begin: string, end: string) => ({
  id,
  begin,
  end,
  user: 2,
  project: 1,
  activity: 1,
  break: 0,
});
const lesen = (timesheet: unknown[]) =>
  kimaiLesen(
    new TextEncoder().encode(
      kimaiAbzugText({
        von: "2026-09-01",
        bis: "2026-10-31",
        user: weber.users,
        customer: weber.customers,
        project: weber.projects,
        activity: weber.activities,
        timesheet,
      }),
    ),
  );

describe("review S-705: a refused timesheet gives no booking", () => {
  it("a timesheet of 30 hours", () => {
    const g = lesen([zeit(1, "2026-09-07T07:00:00+0200", "2026-09-08T13:00:00+0200")]);
    expect(g.fehler.map((f) => f.grund)).toEqual(["zeit_ungueltig"]);
    expect(g.daten.buchungen.map((b) => [b.externalId, (b.ende - b.beginn) / 3_600_000])).toEqual(
      [],
    );
  });
  it("a timesheet in the hour that comes twice in October", () => {
    // 2026-10-25 02:30 CET (second pass) = 01:30 UTC
    const g = lesen([zeit(2, "2026-10-25T02:30:00+0100", "2026-10-25T06:00:00+0100")]);
    expect(g.fehler.map((f) => f.grund)).toEqual(["zeit_ungueltig"]);
    expect(g.daten.buchungen.map((b) => b.externalId)).toEqual([]);
  });
});
