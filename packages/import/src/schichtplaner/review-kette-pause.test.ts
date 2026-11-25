import { describe, expect, it } from "vitest";
import { crewmeisterAbzug } from "./crewmeister.ts";
import { schichtplanerAbzugText, schichtplanerLesen } from "./index.ts";

/*
 * Review S-706: a Crewmeister chain whose last stamp is an OPEN START_BREAK is a shift still
 * running (the person is on break; github.com/mztechnik/hacs-crewmeister, api/models.py,
 * derive_status: OPEN + START_BREAK = ON_BREAK). BAULISTE S-706 refuses a running time with its
 * line (`laeuft_noch`); CLAUDE.md: never stamp out automatically. The piece before the break must
 * not come as a finished time with Gehen at the start of the break.
 */
describe("review: Crewmeister chain open on a break", () => {
  it("is refused as laeuft_noch, not taken as a time ending at the break", () => {
    const abzug = crewmeisterAbzug(
      {
        members: [{ userId: 501, name: "Tom Becker" }],
        absenceTypes: [],
        absences: [],
        shifts: [],
        workplaces: [],
        stamps: [
          {
            id: 9101,
            userId: 501,
            stampType: "START_WORK",
            timestamp: "2026-09-01T08:00:00+02:00",
            chainStartStampId: 9101,
            stampStatus: "CLOSED",
          },
          {
            id: 9102,
            userId: 501,
            stampType: "START_BREAK",
            timestamp: "2026-09-01T12:00:00+02:00",
            chainStartStampId: 9101,
            stampStatus: "OPEN",
          },
        ],
      },
      { von: "2026-09-01", bis: "2026-09-30" },
    );
    const gelesen = schichtplanerLesen("crewmeister")(
      new TextEncoder().encode(schichtplanerAbzugText(abzug)),
    );
    expect(gelesen.daten.zeiten).toEqual([]);
    expect(gelesen.fehler.map((f) => f.grund)).toContain("laeuft_noch");
  });
});
