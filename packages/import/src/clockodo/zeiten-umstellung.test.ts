import { eingabeInBerlin, plusTage } from "@soll/arbeitszeit";
import { describe, expect, it } from "vitest";
import { abzugText } from "./abzug.ts";
import { clockodoLesen } from "./index.ts";

/*
 * Review S-703: a span is a day and two wall-clock minutes; an end at or before the begin lies on
 * the next day (apps/server/src/modules/umzug/plan-zeiten.ts, spanneVon). The reader refuses only
 * blocks of 24 h or more, but across the spring change a block of 23 h 30 min ends at a later wall
 * time than it began, so the span the planner rebuilds is 30 minutes: 23 hours of working time lost.
 */
const MINUTE = 60_000;

describe("a block across the change to summer time", () => {
  it("is refused or read so that its span gives back its instants", () => {
    const beginn = "2026-03-28T19:00:00Z"; // 20:00 CET
    const ende = "2026-03-29T18:30:00Z"; // 20:30 CEST, 23 h 30 min later
    const text = abzugText({
      von: "2026-03-01",
      bis: "2026-03-31",
      user: [{ id: 1, name: "Sandra Kühn" }],
      customer: [],
      project: [],
      service: [],
      entry: [{ id: 7, users_id: 1, type: 1, time_since: beginn, time_until: ende }],
      absence: [],
    });
    const { daten, fehler } = clockodoLesen(text);
    if (fehler.length === 1 && daten.zeiten.length === 0) return;
    const [zeit] = daten.zeiten;
    expect(zeit).toBeDefined();
    if (!zeit) return;
    const gehenTag = zeit.ende > zeit.beginn ? zeit.tag : plusTage(zeit.tag, 1);
    const kommen = eingabeInBerlin(zeit.tag, zeit.beginn);
    const gehen = eingabeInBerlin(gehenTag, zeit.ende);
    expect(kommen).toBe(Date.parse(beginn));
    expect(((gehen ?? 0) - (kommen ?? 0)) / MINUTE).toBe(23 * 60 + 30);
  });
});
