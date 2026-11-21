import { describe, expect, it } from "vitest";
import type { TeamAntwort } from "./typen.ts";
import { teamZustand } from "./zustand.ts";

const werte = {
  anwesendMinuten: 1_440,
  abrechenbarMinuten: 600,
  internMinuten: 60,
  ohneBuchungMinuten: 780,
  abrechenbarProzent: 42,
};
const antwort = (team: TeamAntwort["team"]) => ({
  ok: true as const,
  status: 200,
  daten: { monat: "2026-11", jePersonSeit: null, team },
});

describe("teamZustand", () => {
  it("shows the numbers of a team, or why there are none", () => {
    expect(teamZustand(antwort({ art: "team", personen: 3, ...werte }))).toEqual({
      art: "werte",
      werte: { art: "team", personen: 3, ...werte },
    });
    expect(teamZustand(antwort({ art: "zu_klein", personen: 2, mindestens: 3 }))).toEqual({
      art: "zu_klein",
      mindestens: 3,
    });
    expect(teamZustand({ ok: false, status: 422, fehler: "monat_laeuft" })).toEqual({
      art: "monat_laeuft",
    });
    expect(teamZustand({ ok: false, status: 0, fehler: "netz" })).toEqual({ art: "fehler" });
  });
});
