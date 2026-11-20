import { describe, expect, it } from "vitest";
import { arbeitstage } from "./arbeitstag.ts";
import type { Stempelung } from "./stempelungen.ts";
import { arten, einTag, gehen, kommen, pause, SPAETER, tage, um, weiter } from "./testhilfen.ts";

/*
 * Stamps as they arrive: in any order, repeated, unpaired, on odd seconds (docs/regeln.md, R-01;
 * CLAUDE.md: never round working time to the employee's disadvantage).
 */
describe("unordered, repeated and unpaired stamps", () => {
  const woche = [
    kommen("2026-11-16T08:00+01:00"),
    pause("2026-11-16T12:00+01:00"),
    weiter("2026-11-16T12:30+01:00"),
    gehen("2026-11-16T16:30+01:00"),
    kommen("2026-11-16T22:00+01:00"),
    gehen("2026-11-17T06:00+01:00"),
  ];

  it("gives the same days for stamps in any order", () => {
    const geordnet = tage(woche);
    expect(tage([...woche].reverse())).toEqual(geordnet);
    expect(
      tage([woche[3], woche[0], woche[5], woche[2], woche[4], woche[1]] as Stempelung[]),
    ).toEqual(geordnet);
  });

  it("drops a stamp sent twice, or tapped twice in the same minute, without a finding", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00:05+01:00"),
      kommen("2026-11-16T08:00:05+01:00"),
      kommen("2026-11-16T08:00:40+01:00"),
      gehen("2026-11-16T16:00+01:00"),
      gehen("2026-11-16T16:00+01:00"),
    ]);
    expect(tag.befunde).toEqual([]);
    expect(tag.arbeitsMinuten).toBe(480);
  });

  it("takes the earliest of repeated starts and the latest of repeated ends, with a Hinweis", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      kommen("2026-11-16T08:10+01:00"),
      pause("2026-11-16T12:00+01:00"),
      pause("2026-11-16T12:05+01:00"),
      weiter("2026-11-16T12:35+01:00"),
      weiter("2026-11-16T12:40+01:00"),
      gehen("2026-11-16T16:00+01:00"),
      gehen("2026-11-16T16:20+01:00"),
    ]);
    expect(tag.beginn).toBe(um("2026-11-16T08:00+01:00"));
    expect(tag.ende).toBe(um("2026-11-16T16:20+01:00"));
    expect(tag.pausenMinuten).toBe(30);
    expect(tag.arbeitsMinuten).toBe(470);
    expect(arten(tag)).toEqual(["doppelt", "doppelt", "doppelt", "doppelt"]);
    // a repeated stamp is a Hinweis to check it; the day still has begin, end and duration
    expect(tag.vollstaendig).toBe(true);
  });

  it("reports a Gehen without Kommen on its day, and the day is incomplete", () => {
    const tag = einTag([gehen("2026-11-16T16:00+01:00")]);
    expect(tag.tag).toBe("2026-11-16");
    expect(tag.schichten).toEqual([]);
    expect(arten(tag)).toEqual(["kommen_fehlt"]);
    expect(tag.vollstaendig).toBe(false);
  });

  it("reports an end of break without its start and ignores it", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      weiter("2026-11-16T12:30+01:00"),
      gehen("2026-11-16T16:00+01:00"),
    ]);
    expect(arten(tag)).toEqual(["pause_beginn_fehlt"]);
    expect(tag.arbeitsMinuten).toBe(480);
    expect(tag.vollstaendig).toBe(false);
  });

  it("reports a Gehen during a break as a missing end of break and counts up to the break", () => {
    const tag = einTag([
      kommen("2026-11-16T22:00+01:00"),
      pause("2026-11-16T23:30+01:00"),
      gehen("2026-11-17T06:00+01:00"),
    ]);
    expect(tag.tag).toBe("2026-11-16");
    expect(arten(tag)).toEqual(["pause_ende_fehlt"]);
    expect(tag.arbeitsMinuten).toBe(90);
    expect(tag.vollstaendig).toBe(false);
  });

  it("does not count a break as work when Gehen during it is repeated", () => {
    const tag = einTag([
      kommen("2026-11-16T22:00+01:00"),
      pause("2026-11-16T23:30+01:00"),
      gehen("2026-11-17T06:00+01:00"),
      gehen("2026-11-17T06:05+01:00"),
    ]);
    expect(arten(tag)).toEqual(["pause_ende_fehlt", "doppelt"]);
    expect(tag.arbeitsMinuten).toBe(90);
  });

  it("takes Kommen as the end of a break", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T12:00+01:00"),
      kommen("2026-11-16T12:30+01:00"),
      gehen("2026-11-16T16:30+01:00"),
    ]);
    expect(tag.befunde).toEqual([]);
    expect(tag.schichten[0]?.pausen[0]?.art).toBe("gestempelt");
    expect(tag.arbeitsMinuten).toBe(480);
  });

  it("orders stamps of the same instant so that they pair: Gehen then Kommen, Kommen then Pause", () => {
    const tag = einTag([
      kommen("2026-11-16T12:00+01:00"),
      gehen("2026-11-16T12:00+01:00"),
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T14:00+01:00"),
      kommen("2026-11-16T14:00+01:00"),
      gehen("2026-11-16T16:00+01:00"),
    ]);
    expect(tag.befunde).toEqual([]);
    expect(tag.arbeitsMinuten).toBe(480);
  });
});

describe("minutes, never to the employee's disadvantage", () => {
  it("cuts a start down and an end up to the whole minute", () => {
    const tag = einTag([kommen("2026-11-16T08:00:59+01:00"), gehen("2026-11-16T16:00:01+01:00")]);
    expect(tag.arbeitsMinuten).toBe(481);
    expect(tag.beginn).toBe(um("2026-11-16T08:00+01:00"));
    expect(tag.ende).toBe(um("2026-11-16T16:01+01:00"));
  });

  it("shortens a break to whole minutes inside it, so a break of 15:50 counts 14 min", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T12:00:05+01:00"),
      weiter("2026-11-16T12:15:55+01:00"),
      gehen("2026-11-16T16:00+01:00"),
    ]);
    expect(tag.schichten[0]?.pausen[0]).toMatchObject({ minuten: 14, ruhepause: false });
    expect(tag.arbeitsMinuten).toBe(480);
  });

  it("merges a break shorter than a minute into the work around it", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T12:00:30+01:00"),
      weiter("2026-11-16T12:00:50+01:00"),
      gehen("2026-11-16T16:00+01:00"),
    ]);
    expect(tag.schichten[0]?.pausen).toEqual([]);
    expect(tag.schichten[0]?.arbeit).toHaveLength(1);
    expect(tag.arbeitsMinuten).toBe(480);
  });

  it("adds up to the parts: work and breaks fill the shift from begin to end", () => {
    const tag = einTag([
      kommen("2026-11-16T07:58:12+01:00"),
      pause("2026-11-16T11:02:40+01:00"),
      weiter("2026-11-16T11:40:03+01:00"),
      gehen("2026-11-16T16:31:30+01:00"),
    ]);
    const schicht = tag.schichten[0];
    const spanne = ((schicht?.ende ?? 0) - (schicht?.beginn ?? 0)) / 60_000;
    expect(tag.arbeitsMinuten + tag.pausenMinuten).toBe(spanne);
    expect(schicht?.arbeit.reduce((summe, teil) => summe + teil.minuten, 0)).toBe(
      tag.arbeitsMinuten,
    );
  });
});

describe("input", () => {
  it("refuses an instant that is not a whole number of milliseconds or a kind it does not know", () => {
    expect(arbeitstage([{ art: "kommen", zeitpunkt: 1.5 }], SPAETER)).toEqual({
      ok: false,
      grund: "ungueltig",
    });
    expect(arbeitstage([{ art: "kommen", zeitpunkt: Number.NaN }], SPAETER).ok).toBe(false);
    const fremd = { art: "urlaub", zeitpunkt: 0 } as unknown as Stempelung;
    expect(arbeitstage([fremd], SPAETER).ok).toBe(false);
    expect(arbeitstage([], Number.POSITIVE_INFINITY).ok).toBe(false);
  });
});
