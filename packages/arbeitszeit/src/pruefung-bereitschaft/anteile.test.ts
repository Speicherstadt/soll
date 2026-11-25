import { describe, expect, it } from "vitest";
import { tage } from "../pruefung/testhilfen.ts";
import { einsatzAnteile, zusatzMinutenJeTag } from "./anteile.ts";
import { DI, kommen, MO, SPAETER, schicht, uhr, um } from "./testhilfen.ts";

/*
 * The working day and the minutes of each call-out as working time (R-12, S-505 review): a call-out
 * never moves stamped work to another working day, and what is stamped at the same time counts once.
 * Mo is 16.11.2026.
 */
/** The day and minutes of each call-out, for the cases that name only these */
const kurz = (...args: Parameters<typeof einsatzAnteile>) =>
  einsatzAnteile(...args).map(({ tag, minuten }) => ({ tag, minuten }));

const einsatz = (beginn: string, ende: string | null) => ({
  beginn: um(beginn),
  ende: ende === null ? null : um(ende),
});

describe("einsatzAnteile", () => {
  it("a call-out after a shift within 9 hours belongs to the shift's day", () => {
    const gestempelt = tage(schicht(uhr(MO, "12:00"), uhr(MO, "18:00")), SPAETER);
    expect(kurz(gestempelt, [einsatz(uhr(DI, "2:00"), uhr(DI, "3:00"))])).toEqual([
      { tag: "2026-11-16", minuten: 60 },
    ]);
  });

  it("a call-out far from other work is a day of its own, a running one counts nothing yet", () => {
    expect(
      kurz([], [einsatz(uhr(MO, "23:00"), uhr(DI, "0:30")), einsatz(uhr(DI, "20:00"), null)]),
    ).toEqual([
      { tag: "2026-11-16", minuten: 90 },
      { tag: "2026-11-17", minuten: 0 },
    ]);
  });

  it("what is stamped at the same time counts once", () => {
    const gestempelt = tage(schicht(uhr(MO, "20:00"), uhr(MO, "21:00")), SPAETER);
    expect(kurz(gestempelt, [einsatz(uhr(MO, "20:30"), uhr(MO, "21:30"))])).toEqual([
      { tag: "2026-11-16", minuten: 30 },
    ]);
  });

  it("two call-outs at the same time count once", () => {
    expect(
      kurz(
        [],
        [einsatz(uhr(MO, "22:00"), uhr(MO, "23:00")), einsatz(uhr(MO, "22:30"), uhr(MO, "23:30"))],
      ),
    ).toEqual([
      { tag: "2026-11-16", minuten: 60 },
      { tag: "2026-11-16", minuten: 30 },
    ]);
  });

  it("a call-out right before stamped work keeps its own day, the work stays on its own", () => {
    // 31.10. 23:30 – 23:50, stamped 1.11. from 0:00: the work is a day of 1 November
    const gestempelt = tage(schicht("2026-11-01T00:00+01:00", "2026-11-01T08:00+01:00"), SPAETER);
    expect(gestempelt.map((tag) => tag.tag)).toEqual(["2026-11-01"]);
    expect(kurz(gestempelt, [einsatz("2026-10-31T23:30+01:00", "2026-10-31T23:50+01:00")])).toEqual(
      [{ tag: "2026-10-31", minuten: 20 }],
    );
  });

  it("Herbst: 1:30 summer time to 2:30 winter time on 25.10.2026 is two hours", () => {
    expect(kurz([], [einsatz("2026-10-25T01:30+02:00", "2026-10-25T02:30+01:00")])).toEqual([
      { tag: "2026-10-25", minuten: 120 },
    ]);
  });
});

describe("einsatzAnteile with an open shift (review S-505, round 2)", () => {
  it("a forgotten Gehen holds at most 24 hours, a call-out two days later counts", () => {
    const gestempelt = tage([kommen(uhr("16", "8:00"))], SPAETER);
    expect(
      kurz(gestempelt, [{ beginn: um(uhr("18", "2:00")), ende: um(uhr("18", "3:00")) }]),
    ).toEqual([{ tag: "2026-11-18", minuten: 60 }]);
  });
});

describe("zusatzMinutenJeTag (review S-505, round 3)", () => {
  it("a gap under 15 min between a call-out and stamped work is working time, on the stamped day", () => {
    // call-out Mo 22:00 – 23:50, stamped Di 0:00 – 3:00: 110 + 10 + 180 = 300 like stamped
    const gestempelt = tage(schicht(uhr(DI, "0:00"), uhr(DI, "3:00")), SPAETER);
    const zusatz = zusatzMinutenJeTag(gestempelt, [
      { tag: "2026-11-16", beginn: um(uhr(MO, "22:00")), ende: um(uhr(MO, "23:50")) },
    ]);
    expect(zusatz).toEqual(
      new Map([
        ["2026-11-16", 110],
        ["2026-11-17", 10],
      ]),
    );
  });

  it("a gap of 15 min or more is a Ruhepause and adds nothing", () => {
    const gestempelt = tage(schicht(uhr(MO, "22:00"), uhr(MO, "23:30")), SPAETER);
    const zusatz = zusatzMinutenJeTag(gestempelt, [
      { tag: "2026-11-16", beginn: um(uhr(DI, "0:30")), ende: um(uhr(DI, "2:00")) },
    ]);
    expect(zusatz).toEqual(new Map([["2026-11-16", 90]]));
  });
});
