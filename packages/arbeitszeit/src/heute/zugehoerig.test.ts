import { describe, expect, it } from "vitest";
import { gehen, kommen, um } from "../arbeitstag/testhilfen.ts";
import { stempelungenAm } from "./zugehoerig.ts";

const JETZT = um("2026-11-21T12:00:00+01:00");

describe("the stamps of a working day", () => {
  it("are those of the shifts that begin on it, a night shift's Gehen after midnight included", () => {
    const nacht = [kommen("2026-11-19T22:00:00+01:00"), gehen("2026-11-20T06:00:00+01:00")];
    const tag = [kommen("2026-11-20T16:00:00+01:00"), gehen("2026-11-20T20:00:00+01:00")];
    const alle = [...nacht, ...tag].map((stempel, index) => ({ ...stempel, id: index }));
    expect(stempelungenAm(alle, JETZT, "2026-11-19").map((s) => s.id)).toEqual([0, 1]);
    expect(stempelungenAm(alle, JETZT, "2026-11-20").map((s) => s.id)).toEqual([2, 3]);
  });

  it("puts a stamp outside every shift on its Berlin day, as R-01 reports it", () => {
    const alle = [{ ...gehen("2026-11-20T09:00:00+01:00"), id: "x" }];
    expect(stempelungenAm(alle, JETZT, "2026-11-20")).toEqual(alle);
    expect(stempelungenAm(alle, JETZT, "2026-11-19")).toEqual([]);
  });

  it("keeps the stamps of a shift that still runs, in time order", () => {
    const alle = [
      { ...kommen("2026-11-21T08:00:00+01:00"), id: 2 },
      { ...kommen("2026-11-21T07:59:30+01:00"), id: 1 },
    ];
    expect(stempelungenAm(alle, JETZT, "2026-11-21").map((s) => s.id)).toEqual([1, 2]);
  });

  it("returns nothing for stamps that name no day", () => {
    expect(stempelungenAm([{ art: "kommen", zeitpunkt: Number.NaN }], JETZT, "2026-11-20")).toEqual(
      [],
    );
  });
});
