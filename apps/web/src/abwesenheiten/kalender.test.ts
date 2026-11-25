import { describe, expect, it } from "vitest";
import { kalender, tageVonBis } from "./kalender.ts";
import type { TeamEintrag } from "./typen.ts";

const eintrag = (nutzerId: string, von: string, bis: string, mehr: Partial<TeamEintrag> = {}) =>
  ({
    abwesenheitId: `${nutzerId}-${von}`,
    nutzerId,
    name: nutzerId,
    art: "abwesend",
    von,
    bis,
    ersterHalb: false,
    letzterHalb: false,
    ...mehr,
  }) satisfies TeamEintrag;

describe("tageVonBis", () => {
  it("lists every day, also across the turn of a month and of the clocks", () => {
    expect(tageVonBis("2026-10-24", "2026-10-26")).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
    ]);
    expect(tageVonBis("2026-12-31", "2027-01-01")).toEqual(["2026-12-31", "2027-01-01"]);
  });
});

describe("kalender: a row per person, a cell per day", () => {
  it("marks whole and half days, merges a person's absences into one row, sorted by name", () => {
    const { tage, zeilen } = kalender(
      [
        eintrag("tom", "2026-12-01", "2026-12-02", { letzterHalb: true }),
        eintrag("lea", "2026-11-29", "2026-11-30"),
        eintrag("tom", "2026-12-04", "2026-12-04", { ersterHalb: true }),
      ],
      "2026-11-30",
      "2026-12-04",
    );
    expect(tage).toHaveLength(5);
    expect(zeilen).toEqual([
      { nutzerId: "lea", name: "lea", zellen: ["ganz", null, null, null, null] },
      { nutzerId: "tom", name: "tom", zellen: [null, "ganz", "halb", null, "halb"] },
    ]);
  });

  it("a single day both first and last half is half", () => {
    const { zeilen } = kalender(
      [eintrag("tom", "2026-12-01", "2026-12-01", { ersterHalb: true, letzterHalb: true })],
      "2026-12-01",
      "2026-12-01",
    );
    expect(zeilen[0]?.zellen).toEqual(["halb"]);
  });
});
