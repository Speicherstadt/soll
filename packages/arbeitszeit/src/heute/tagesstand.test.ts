import { describe, expect, it } from "vitest";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import { gehen, kommen, pause, um, weiter } from "../arbeitstag/testhilfen.ts";
import { aktuellerTag, type Tagesstand, tagesstand } from "./tagesstand.ts";

/*
 * The running day on Heute (BAULISTE.md S-304): the state, the minutes so far and the next finding.
 * Wall-clock times carry their offset; 20.11.2026 is in winter time (+01:00).
 */
const am = (zeit: string) => um(`2026-11-20T${zeit}+01:00`);
const stand = (stempel: Stempelung[], jetzt: string, tag?: string): Tagesstand => {
  const zeitpunkt = am(jetzt);
  const ergebnis = tagesstand(stempel, zeitpunkt, tag ?? aktuellerTag(stempel, zeitpunkt));
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};
const arten = (wert: Tagesstand) => wert.befunde.map((befund) => befund.art);

describe("the state of the person", () => {
  it("is out without a stamp, with nothing counted and nothing ahead", () => {
    expect(stand([], "09:00")).toMatchObject({
      tag: "2026-11-20",
      zustand: "aus",
      seit: null,
      istMinuten: 0,
      pausenMinuten: 0,
      befunde: [],
      ausblick: null,
      nichtHinterlegt: false,
    });
  });

  it("is working since Kommen, with the minutes so far and the break due under § 4 ArbZG", () => {
    // design/mockup/Main.dc.html: in since 7:58, 4:12 so far, break due in 1:48
    const wert = stand([kommen("2026-11-20T07:58:00+01:00")], "12:10");
    expect(wert).toMatchObject({
      zustand: "arbeit",
      seit: am("07:58"),
      istMinuten: 252,
      ausblick: { art: "pause", regel: "R-04", norm: "§ 4 ArbZG", inMinuten: 108, minuten: 30 },
    });
    expect(wert.ausblick?.um).toBe(am("13:58"));
  });

  it("counts the minute begun, never against the person (CLAUDE.md)", () => {
    const wert = stand([kommen("2026-11-20T08:00:59+01:00")], "08:01");
    expect(wert.istMinuten).toBe(1);
    const spaeter = tagesstand(
      [kommen("2026-11-20T08:00:59+01:00")],
      am("08:01") + 1_000,
      "2026-11-20",
    );
    expect(spaeter.ok && spaeter.wert.istMinuten).toBe(2);
  });

  it("is on a break since Pause, with the break running and nothing ahead", () => {
    const wert = stand(
      [kommen("2026-11-20T08:00:00+01:00"), pause("2026-11-20T12:00:00+01:00")],
      "12:10",
    );
    expect(wert).toMatchObject({
      zustand: "pause",
      seit: am("12:00"),
      istMinuten: 240,
      pausenMinuten: 10,
      ausblick: null,
      befunde: [],
    });
  });

  it("is out after Gehen, with the rest due under § 5 ArbZG until the next Kommen", () => {
    const wert = stand(
      [
        kommen("2026-11-20T08:00:00+01:00"),
        pause("2026-11-20T12:00:00+01:00"),
        weiter("2026-11-20T12:30:00+01:00"),
        gehen("2026-11-20T16:30:00+01:00"),
      ],
      "18:00",
    );
    expect(wert).toMatchObject({
      zustand: "aus",
      istMinuten: 480,
      pausenMinuten: 30,
      beginn: am("08:00"),
      ende: am("16:30"),
      befunde: [],
      ausblick: { art: "ruhezeit", regel: "R-05", norm: "§ 5 Abs. 1 ArbZG", inMinuten: 570 },
    });
    expect(wert.ausblick?.um).toBe(um("2026-11-21T03:30:00+01:00"));
  });

  it("drops the rest from the outlook once it has passed", () => {
    const stempel = [kommen("2026-11-20T08:00:00+01:00"), gehen("2026-11-20T12:00:00+01:00")];
    const ergebnis = tagesstand(stempel, um("2026-11-20T23:30:00+01:00"), "2026-11-20");
    expect(ergebnis.ok && ergebnis.wert.ausblick).toBeNull();
  });
});

describe("the next finding while working", () => {
  it("names 8 hours under § 3 ArbZG once the break owed was taken", () => {
    const wert = stand(
      [
        kommen("2026-11-20T08:00:00+01:00"),
        pause("2026-11-20T12:00:00+01:00"),
        weiter("2026-11-20T12:30:00+01:00"),
      ],
      "15:00",
    );
    expect(wert.istMinuten).toBe(390);
    expect(wert.pausenMinuten).toBe(30);
    expect(wert.ausblick).toMatchObject({
      art: "acht_stunden",
      regel: "R-02",
      norm: "§ 3 ArbZG",
      inMinuten: 90,
    });
  });

  it("names 10 hours under § 3 ArbZG when nothing comes sooner", () => {
    const wert = stand(
      [
        kommen("2026-11-20T08:00:00+01:00"),
        pause("2026-11-20T12:00:00+01:00"),
        weiter("2026-11-20T12:45:00+01:00"),
        pause("2026-11-20T15:00:00+01:00"),
        weiter("2026-11-20T15:15:00+01:00"),
      ],
      "18:30",
    );
    expect(wert.istMinuten).toBe(570);
    expect(wert.ausblick).toMatchObject({ art: "zehn_stunden", inMinuten: 30 });
  });

  it("names the 45 minutes owed after 9 hours when they come first", () => {
    const wert = stand(
      [
        kommen("2026-11-20T06:00:00+01:00"),
        pause("2026-11-20T09:00:00+01:00"),
        weiter("2026-11-20T09:30:00+01:00"),
      ],
      "14:50",
    );
    // 500 minutes, 30 of break: 40 to 9 hours, 15 more owed; 8 hours were passed already
    expect(wert.ausblick).toMatchObject({ art: "pause", inMinuten: 40, minuten: 15 });
  });

  it("names the break after six hours in a row (§ 4 Satz 3 ArbZG) after an early break", () => {
    const wert = stand(
      [
        kommen("2026-11-20T06:00:00+01:00"),
        pause("2026-11-20T07:00:00+01:00"),
        weiter("2026-11-20T07:30:00+01:00"),
      ],
      "12:30",
    );
    // 360 minutes of work, 300 of them in the running block: 60 to the six hours in a row
    expect(wert.ausblick).toMatchObject({ art: "pause", inMinuten: 60, minuten: 15 });
  });

  it("shows the breach as it stands when the break is overdue, and the next limit ahead", () => {
    const wert = stand([kommen("2026-11-20T08:00:00+01:00")], "14:30");
    expect(arten(wert)).toEqual(["pause_fehlt", "ohne_pause"]);
    expect(wert.befunde.map((befund) => befund.norm)).toEqual([
      "§ 4 Satz 1 ArbZG",
      "§ 4 Satz 3 ArbZG",
    ]);
    expect(wert.ausblick).toMatchObject({ art: "acht_stunden", inMinuten: 90 });
  });

  it("has 10 hours no longer ahead once they are passed, only the breach", () => {
    const wert = stand(
      [
        kommen("2026-11-20T06:00:00+01:00"),
        pause("2026-11-20T09:00:00+01:00"),
        weiter("2026-11-20T09:45:00+01:00"),
        pause("2026-11-20T13:00:00+01:00"),
        weiter("2026-11-20T13:15:00+01:00"),
      ],
      "17:30",
    );
    expect(wert.istMinuten).toBe(630);
    expect(arten(wert)).toEqual(["ueber_10h"]);
    // the block since the last break is 255 minutes: six hours in a row come in 105
    expect(wert.ausblick).toMatchObject({ art: "pause", inMinuten: 105, minuten: 15 });
  });
});

describe("days around the running one", () => {
  it("is the day a night shift began on while it runs", () => {
    const stempel = [kommen("2026-11-19T22:00:00+01:00")];
    expect(aktuellerTag(stempel, am("02:00"))).toBe("2026-11-19");
    expect(stand(stempel, "02:00")).toMatchObject({
      tag: "2026-11-19",
      zustand: "arbeit",
      istMinuten: 240,
    });
  });

  it("keeps a forgotten Gehen open and reports it, never stamping out (R-01)", () => {
    const stempel = [kommen("2026-11-19T08:00:00+01:00")];
    const wert = stand(stempel, "07:00");
    expect(wert).toMatchObject({
      tag: "2026-11-19",
      zustand: "arbeit",
      istMinuten: 0,
      ausblick: null,
    });
    expect(wert.befunde).toEqual([
      expect.objectContaining({
        art: "gehen_fehlt",
        regel: "R-01",
        norm: "§ 3 Abs. 2 Nr. 1 ArbSchG",
      }),
    ]);
  });

  it("is out 24 hours after a Kommen without Gehen, when no stamp can end the shift", () => {
    const stempel = [kommen("2026-11-19T08:00:00+01:00")];
    expect(aktuellerTag(stempel, am("08:00"))).toBe("2026-11-20");
    expect(stand(stempel, "08:00")).toMatchObject({
      tag: "2026-11-20",
      zustand: "aus",
      ausblick: null,
    });
  });

  it("shows a past day as it was, with its findings and without an outlook", () => {
    const stempel = [kommen("2026-11-19T07:00:00+01:00"), gehen("2026-11-19T14:30:00+01:00")];
    const wert = stand(stempel, "09:00", "2026-11-19");
    expect(wert).toMatchObject({ tag: "2026-11-19", istMinuten: 450, ausblick: null });
    expect(arten(wert)).toEqual(["pause_fehlt", "ohne_pause"]);
  });

  it("reports the rest between two days on the day it ends, under § 5 ArbZG", () => {
    const stempel = [
      kommen("2026-11-19T14:00:00+01:00"),
      gehen("2026-11-19T22:00:00+01:00"),
      kommen("2026-11-20T07:30:00+01:00"),
    ];
    // 9:30 of rest: a new shift (from 9 hours on), but 1:30 short of 11 hours
    expect(arten(stand(stempel, "08:00"))).toEqual(["ruhezeit_zu_kurz"]);
  });

  it("says nicht hinterlegt before the first rule version, and judges nothing", () => {
    const stempel = [kommen("2025-12-31T07:00:00+01:00")];
    const ergebnis = tagesstand(stempel, um("2025-12-31T14:30:00+01:00"), "2025-12-31");
    expect(ergebnis.ok && ergebnis.wert).toMatchObject({
      nichtHinterlegt: true,
      befunde: [],
      ausblick: null,
      istMinuten: 450,
    });
  });

  it("refuses an instant that names no day", () => {
    expect(
      tagesstand([{ art: "kommen", zeitpunkt: Number.NaN }], am("09:00"), "2026-11-20"),
    ).toEqual({
      ok: false,
      grund: "ungueltig",
    });
  });

  it("deducts missing statutory break transparently on closed shifts without hiding R-04 findings", () => {
    const stempel = [kommen("2026-11-19T07:00:00+01:00"), gehen("2026-11-19T14:30:00+01:00")];
    const ergebnis = tagesstand(stempel, am("09:00"), "2026-11-19", { pausenabzug: true });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert).toMatchObject({
      istMinuten: 420,
      pausenMinuten: 30,
      pausenabzugMinuten: 30,
    });
    expect(arten(ergebnis.wert)).toEqual(["pause_fehlt", "ohne_pause"]);
  });

  it("does not apply automatic break deduction while a shift is still running", () => {
    const stempel = [kommen("2026-11-20T06:00:00+01:00")];
    const ergebnis = tagesstand(stempel, am("13:30"), "2026-11-20", { pausenabzug: true });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert).toMatchObject({
      zustand: "arbeit",
      istMinuten: 450,
      pausenMinuten: 0,
      pausenabzugMinuten: 0,
    });
  });
});
