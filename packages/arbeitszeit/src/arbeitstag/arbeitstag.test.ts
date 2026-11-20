import { describe, expect, it } from "vitest";
import { type Arbeitstag, arbeitstage } from "./arbeitstag.ts";
import type { Stempelart, Stempelung } from "./stempelungen.ts";

/*
 * BAULISTE.md S-201 and docs/regeln.md R-01 (cases taken literally), R-04 (an interruption under
 * 15 minutes is working time) and the Grundbegriffe "Arbeitstag" and "Schicht". Wall-clock times
 * carry their UTC offset, so every DST case states which side of the change it is on.
 */
const um = (text: string) => Date.parse(text);
const s = (art: Stempelart, text: string): Stempelung => ({ art, zeitpunkt: um(text) });
const kommen = (text: string) => s("kommen", text);
const gehen = (text: string) => s("gehen", text);
const pause = (text: string) => s("pause_beginn", text);
const weiter = (text: string) => s("pause_ende", text);

const SPAETER = um("2030-01-01T00:00:00Z");

const tage = (stempelungen: Stempelung[], jetzt = SPAETER): Arbeitstag[] => {
  const ergebnis = arbeitstage(stempelungen, jetzt);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};
const einTag = (stempelungen: Stempelung[], jetzt = SPAETER): Arbeitstag => {
  const alle = tage(stempelungen, jetzt);
  expect(alle).toHaveLength(1);
  return alle[0] as Arbeitstag;
};
const arten = (tag: Arbeitstag) => tag.befunde.map((befund) => befund.art);

describe("S-201: a night shift over the DST changes", () => {
  it("22:00 to 6:00 over 25.10.2026 is 9 h: the clocks go back at 3:00 (CEST to CET)", () => {
    const tag = einTag([kommen("2026-10-24T22:00+02:00"), gehen("2026-10-25T06:00+01:00")]);
    expect(tag.arbeitsMinuten).toBe(540);
    expect(tag.tag).toBe("2026-10-24");
  });

  it("22:00 to 6:00 over 28.03.2027 is 7 h: the clocks go forward at 2:00 (CET to CEST)", () => {
    const tag = einTag([kommen("2027-03-27T22:00+01:00"), gehen("2027-03-28T06:00+02:00")]);
    expect(tag.arbeitsMinuten).toBe(420);
    expect(tag.tag).toBe("2027-03-27");
  });

  it("counts a stamp in the hour that comes twice in October as the instant it is", () => {
    // 2:30 CEST, then 2:30 CET one hour later: the same wall clock, 60 real minutes apart
    const tag = einTag([kommen("2026-10-25T02:30+02:00"), gehen("2026-10-25T02:30+01:00")]);
    expect(tag.arbeitsMinuten).toBe(60);
    expect(tag.tag).toBe("2026-10-25");
  });

  it("gives each part its own minutes, also when a break lies in the repeated hour", () => {
    const tag = einTag([
      kommen("2026-10-24T22:00+02:00"),
      pause("2026-10-25T02:45+02:00"),
      weiter("2026-10-25T02:15+01:00"),
      gehen("2026-10-25T06:00+01:00"),
    ]);
    const schicht = tag.schichten[0];
    expect(schicht?.arbeit.map((teil) => teil.minuten)).toEqual([285, 225]);
    expect(schicht?.pausen.map((teil) => teil.minuten)).toEqual([30]);
    expect(tag.arbeitsMinuten).toBe(510);
    expect(tag.pausenMinuten).toBe(30);
  });
});

describe("R-01: Beginn, Ende und Dauer", () => {
  it("erlaubt: Mo 8:00 Kommen, 16:30 Gehen – no finding, 8:30 before breaks", () => {
    const tag = einTag([kommen("2026-11-16T08:00+01:00"), gehen("2026-11-16T16:30+01:00")]);
    expect(tag.befunde).toEqual([]);
    expect(tag.arbeitsMinuten).toBe(510);
    expect(tag.beginn).toBe(um("2026-11-16T08:00+01:00"));
    expect(tag.ende).toBe(um("2026-11-16T16:30+01:00"));
    expect(tag.vollstaendig).toBe(true);
  });

  it("Grenze: night shift Mo 22:00, still open Di 13:59 (15:59 h) – no finding", () => {
    const tag = einTag([kommen("2026-11-16T22:00+01:00")], um("2026-11-17T13:59+01:00"));
    expect(tag.befunde).toEqual([]);
    expect(tag.vollstaendig).toBe(false);
    expect(tag.schichten[0]?.offen).toEqual({
      art: "gehen",
      seit: um("2026-11-16T22:00+01:00"),
      faellig: um("2026-11-17T14:00+01:00"),
    });
  });

  it("Verstoß: Mo 8:00 Kommen, no Gehen, Di 0:00 – Hinweis „Gehen fehlt“ for Mo", () => {
    const tag = einTag([kommen("2026-11-16T08:00+01:00")], um("2026-11-17T00:00+01:00"));
    expect(tag.befunde).toEqual([
      {
        regel: "R-01",
        norm: "§ 3 Abs. 2 Nr. 1 ArbSchG",
        schwere: "hinweis",
        art: "gehen_fehlt",
        tage: ["2026-11-16"],
        zeitpunkt: um("2026-11-16T08:00+01:00"),
      },
    ]);
    expect(tag.vollstaendig).toBe(false);
  });

  it("never ends an open shift itself: it has no end and its time is not counted", () => {
    const tag = einTag([kommen("2026-11-16T08:00+01:00")]);
    expect(tag.ende).toBeNull();
    expect(tag.schichten[0]?.ende).toBeNull();
    expect(tag.schichten[0]?.arbeit).toEqual([]);
    expect(tag.arbeitsMinuten).toBe(0);
  });

  it("is due at midnight after a day shift, 16 h after a night shift, also on the DST night", () => {
    const vor = einTag([kommen("2026-11-16T08:01+01:00")], um("2026-11-17T00:00+01:00"));
    expect(vor.schichten[0]?.offen?.faellig).toBe(um("2026-11-17T00:01+01:00"));
    const herbst = einTag([kommen("2026-10-24T22:00+02:00")]);
    expect(herbst.schichten[0]?.offen?.faellig).toBe(um("2026-10-25T13:00+01:00"));
    const tagschicht = einTag([kommen("2026-10-24T07:00+02:00")]);
    expect(tagschicht.schichten[0]?.offen?.faellig).toBe(um("2026-10-25T00:00+02:00"));
  });

  it("reports a missing end of break the same way and keeps the time before the break", () => {
    const stempel = [kommen("2026-11-16T08:00+01:00"), pause("2026-11-16T12:00+01:00")];
    const laeuft = einTag(stempel, um("2026-11-16T12:20+01:00"));
    expect(laeuft.befunde).toEqual([]);
    expect(laeuft.schichten[0]?.offen?.art).toBe("pause_ende");
    expect(laeuft.arbeitsMinuten).toBe(240);
    const vergessen = einTag(stempel, um("2026-11-17T00:00+01:00"));
    expect(arten(vergessen)).toEqual(["pause_ende_fehlt"]);
  });
});

describe("breaks", () => {
  it("counts a stamped break and a gap between two pairs, each with its kind", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T10:00+01:00"),
      weiter("2026-11-16T10:15+01:00"),
      gehen("2026-11-16T12:00+01:00"),
      kommen("2026-11-16T12:30+01:00"),
      gehen("2026-11-16T16:30+01:00"),
    ]);
    const schicht = tag.schichten[0];
    expect(schicht?.pausen.map(({ art, minuten }) => [art, minuten])).toEqual([
      ["gestempelt", 15],
      ["luecke", 30],
    ]);
    expect(tag.pausenMinuten).toBe(45);
    expect(tag.arbeitsMinuten).toBe(465);
    expect(tag.schichten).toHaveLength(1);
  });

  it("R-04: 14 min + 16 min of break at 8:00 of work – the 14 min count as working time", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T10:00+01:00"),
      weiter("2026-11-16T10:14+01:00"),
      pause("2026-11-16T12:14+01:00"),
      weiter("2026-11-16T12:30+01:00"),
      gehen("2026-11-16T16:30+01:00"),
    ]);
    expect(tag.schichten[0]?.pausen.map((p) => [p.minuten, p.ruhepause])).toEqual([
      [14, false],
      [16, true],
    ]);
    expect(tag.arbeitsMinuten).toBe(494); // 8:00 + 14 min
    expect(tag.pausenMinuten).toBe(16);
    // the blocks of work between Ruhepausen, for § 4 Satz 3 ArbZG (S-202)
    expect(tag.schichten[0]?.bloecke.map((block) => block.minuten)).toEqual([254, 240]);
  });

  it("R-04: 2 × 15 min of break are both Ruhepausen", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T10:00+01:00"),
      weiter("2026-11-16T10:15+01:00"),
      gehen("2026-11-16T13:00+01:00"),
      kommen("2026-11-16T13:15+01:00"),
      gehen("2026-11-16T16:30+01:00"),
    ]);
    expect(tag.pausenMinuten).toBe(30);
    expect(tag.arbeitsMinuten).toBe(480);
    expect(tag.schichten[0]?.bloecke).toHaveLength(3);
  });

  it("keeps a break over midnight inside the night shift of the start day", () => {
    const tag = einTag([
      kommen("2026-11-16T18:00+01:00"),
      gehen("2026-11-16T23:30+01:00"),
      kommen("2026-11-17T00:15+01:00"),
      gehen("2026-11-17T03:00+01:00"),
    ]);
    expect(tag.tag).toBe("2026-11-16");
    expect(tag.arbeitsMinuten).toBe(495);
    expect(tag.pausenMinuten).toBe(45);
  });
});

describe("shifts and working days", () => {
  it("puts a split shift with a gap under 9 h into one shift", () => {
    const tag = einTag([
      kommen("2026-11-16T10:00+01:00"),
      gehen("2026-11-16T14:00+01:00"),
      kommen("2026-11-16T17:00+01:00"),
      gehen("2026-11-16T22:00+01:00"),
    ]);
    expect(tag.schichten).toHaveLength(1);
    expect(tag.arbeitsMinuten).toBe(540);
    expect(tag.pausenMinuten).toBe(180);
  });

  it("keeps two shifts 9 h apart on one day as two shifts of that day, with no break between", () => {
    const tag = einTag([
      kommen("2026-11-16T05:00+01:00"),
      gehen("2026-11-16T08:00+01:00"),
      kommen("2026-11-16T17:00+01:00"),
      gehen("2026-11-16T21:00+01:00"),
    ]);
    expect(tag.schichten).toHaveLength(2);
    expect(tag.arbeitsMinuten).toBe(420);
    expect(tag.pausenMinuten).toBe(0);
  });

  it("starts a new working day after 9 h off, even when the shift before ran past midnight", () => {
    const alle = tage([
      kommen("2026-11-16T22:00+01:00"),
      gehen("2026-11-17T06:00+01:00"),
      kommen("2026-11-17T15:00+01:00"),
      gehen("2026-11-17T23:00+01:00"),
    ]);
    expect(alle.map((tag) => [tag.tag, tag.arbeitsMinuten])).toEqual([
      ["2026-11-16", 480],
      ["2026-11-17", 480],
    ]);
  });

  it("keeps work after less than 9 h off in the shift of the start day", () => {
    // 6:00 to 14:00 after a night shift: 8 h off is no rest the law allows (§ 5, § 7 Abs. 1 Nr. 3
    // ArbZG), so it is the same Werktag, and S-202 reports its 16 h
    const tag = einTag([
      kommen("2026-11-16T22:00+01:00"),
      gehen("2026-11-17T06:00+01:00"),
      kommen("2026-11-17T14:00+01:00"),
      gehen("2026-11-17T22:00+01:00"),
    ]);
    expect(tag.tag).toBe("2026-11-16");
    expect(tag.arbeitsMinuten).toBe(960);
  });

  it("never lets a shift reach 24 h past its start", () => {
    const alle = tage([
      kommen("2026-11-16T00:00+01:00"),
      gehen("2026-11-16T04:00+01:00"),
      kommen("2026-11-16T08:00+01:00"),
      gehen("2026-11-16T12:00+01:00"),
      kommen("2026-11-16T16:00+01:00"),
      gehen("2026-11-16T20:00+01:00"),
      kommen("2026-11-17T00:00+01:00"),
      gehen("2026-11-17T04:00+01:00"),
    ]);
    expect(alle.map((tag) => [tag.tag, tag.arbeitsMinuten])).toEqual([
      ["2026-11-16", 720],
      ["2026-11-17", 240],
    ]);
  });

  it("lists the days in order, each with its shifts", () => {
    const alle = tage([
      kommen("2026-11-17T08:00+01:00"),
      gehen("2026-11-17T12:00+01:00"),
      kommen("2026-11-16T08:00+01:00"),
      gehen("2026-11-16T12:00+01:00"),
    ]);
    expect(alle.map((tag) => tag.tag)).toEqual(["2026-11-16", "2026-11-17"]);
  });

  it("has no day without stamps", () => {
    expect(tage([])).toEqual([]);
  });
});

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
