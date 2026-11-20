import { describe, expect, it } from "vitest";
import { arbeitstage } from "./arbeitstag.ts";
import { arten, einTag, gehen, kommen, pause, tage, um, weiter } from "./testhilfen.ts";

/*
 * BAULISTE.md S-201 and docs/regeln.md R-01 (cases taken literally), R-04 (an interruption under
 * 15 minutes is working time) and the Grundbegriffe "Arbeitstag" and "Schicht".
 */
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

describe("R-01: the cases of the working day, as docs/regeln.md writes them", () => {
  it("Pause: a stamped break of 30 min", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T12:00+01:00"),
      weiter("2026-11-16T12:30+01:00"),
      gehen("2026-11-16T16:30+01:00"),
    ]);
    expect([tag.arbeitsMinuten, tag.pausenMinuten]).toEqual([480, 30]);
    expect(tag.schichten[0]?.pausen[0]?.art).toBe("gestempelt");
  });

  it("Lücke: a gap of 30 min between two pairs", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      gehen("2026-11-16T12:00+01:00"),
      kommen("2026-11-16T12:30+01:00"),
      gehen("2026-11-16T16:30+01:00"),
    ]);
    expect([tag.arbeitsMinuten, tag.pausenMinuten]).toEqual([480, 30]);
    expect(tag.schichten[0]?.pausen[0]?.art).toBe("luecke");
  });

  it("kurze Pause: 14 min are working time, no break", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T12:00+01:00"),
      weiter("2026-11-16T12:14+01:00"),
      gehen("2026-11-16T16:00+01:00"),
    ]);
    expect([tag.arbeitsMinuten, tag.pausenMinuten]).toEqual([480, 0]);
  });

  it("doppelter Tipp: Kommen at 8:00:05 and 8:00:40 is no finding", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00:05+01:00"),
      kommen("2026-11-16T08:00:40+01:00"),
      gehen("2026-11-16T16:00+01:00"),
    ]);
    expect(tag.befunde).toEqual([]);
    expect(tag.arbeitsMinuten).toBe(480);
  });

  it("doppelt: Kommen 8:00 and 8:10, Gehen 16:00 and 16:20 count 8:20, with a Hinweis each", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      kommen("2026-11-16T08:10+01:00"),
      gehen("2026-11-16T16:00+01:00"),
      gehen("2026-11-16T16:20+01:00"),
    ]);
    expect(tag.arbeitsMinuten).toBe(500);
    expect(arten(tag)).toEqual(["doppelt", "doppelt"]);
    expect(tag.vollstaendig).toBe(true);
  });
});

describe("breaks", () => {
  it("Teile: a stamped break and a gap between two pairs, each part with its minutes", () => {
    const tag = einTag([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T10:00+01:00"),
      weiter("2026-11-16T10:15+01:00"),
      gehen("2026-11-16T12:00+01:00"),
      kommen("2026-11-16T12:30+01:00"),
      gehen("2026-11-16T16:30+01:00"),
    ]);
    const schicht = tag.schichten[0];
    expect(schicht?.arbeit.map((teil) => teil.minuten)).toEqual([120, 105, 240]);
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

  /*
   * Review of PR #11: the cap held only between stamped pairs. A stamp 24 h or more after the start
   * of a shift ended it all the same, so a forgotten Gehen became 32 h of work on a complete day.
   * Such a stamp cannot belong to the shift (Grundbegriff "Schicht"): the shift stays open and the
   * stamp is read as if no shift were running, nothing is guessed.
   */
  it("24 h: Kommen Mo 8:00, Kommen Di 8:00, Gehen Di 16:00 – Mo „Gehen fehlt“, Di 8:00", () => {
    const [mo, di] = tage([
      kommen("2026-11-16T08:00+01:00"),
      kommen("2026-11-17T08:00+01:00"),
      gehen("2026-11-17T16:00+01:00"),
    ]);
    expect([mo?.tag, mo?.arbeitsMinuten, mo?.vollstaendig, mo && arten(mo)]).toEqual([
      "2026-11-16",
      0,
      false,
      ["gehen_fehlt"],
    ]);
    expect([di?.tag, di?.arbeitsMinuten, di?.vollstaendig, di && arten(di)]).toEqual([
      "2026-11-17",
      480,
      true,
      [],
    ]);
  });

  it("24 h: a Gehen 24 h or more after Kommen does not end the shift", () => {
    const [mo, mi] = tage([kommen("2026-11-16T08:00+01:00"), gehen("2026-11-18T08:00+01:00")]);
    expect([mo?.tag, mo?.arbeitsMinuten, mo && arten(mo)]).toEqual([
      "2026-11-16",
      0,
      ["gehen_fehlt"],
    ]);
    expect([mi?.tag, mi && arten(mi)]).toEqual(["2026-11-18", ["kommen_fehlt"]]);
  });

  it("24 h: a repeated Gehen 24 h or more after Kommen does not move the end", () => {
    const [mo, di] = tage([
      kommen("2026-11-16T08:00+01:00"),
      gehen("2026-11-16T16:00+01:00"),
      gehen("2026-11-17T10:00+01:00"),
    ]);
    expect([mo?.arbeitsMinuten, mo?.ende, mo && arten(mo)]).toEqual([
      480,
      um("2026-11-16T16:00+01:00"),
      [],
    ]);
    expect([di?.tag, di && arten(di)]).toEqual(["2026-11-17", ["kommen_fehlt"]]);
  });

  it("24 h: a break still running 24 h after Kommen stays open, „Pause-Ende fehlt“", () => {
    const [mo, di] = tage([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T12:00+01:00"),
      pause("2026-11-17T09:00+01:00"),
      weiter("2026-11-17T09:30+01:00"),
    ]);
    expect([mo?.arbeitsMinuten, mo?.vollstaendig, mo && arten(mo)]).toEqual([
      240,
      false,
      ["pause_ende_fehlt"],
    ]);
    expect(mo?.schichten[0]?.offen?.art).toBe("pause_ende");
    expect(di && arten(di)).toEqual(["kommen_fehlt", "kommen_fehlt"]);
  });

  /*
   * Second review of PR #11: 9 h off end a shift (Grundbegriff "Schicht"), so an end stamped 9 h or
   * more after the last one cannot be a repeat of it. Read as "doppelt", it moved the end across the
   * rest and counted it as work.
   */
  it("9 h: a Gehen 9 h or more after the last Gehen does not move the end", () => {
    const [mo, di] = tage([
      kommen("2026-11-16T08:00+01:00"),
      gehen("2026-11-16T12:00+01:00"),
      gehen("2026-11-17T07:30+01:00"),
    ]);
    expect([mo?.arbeitsMinuten, mo?.ende, mo?.vollstaendig, mo && arten(mo)]).toEqual([
      240,
      um("2026-11-16T12:00+01:00"),
      true,
      [],
    ]);
    expect([di?.tag, di?.vollstaendig, di && arten(di)]).toEqual([
      "2026-11-17",
      false,
      ["kommen_fehlt"],
    ]);
  });

  it("9 h: a Pause 9 h or more after the break began does not move its start", () => {
    const [mo, di] = tage([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T12:00+01:00"),
      pause("2026-11-17T07:00+01:00"),
      gehen("2026-11-17T07:30+01:00"),
    ]);
    expect([mo?.arbeitsMinuten, mo?.vollstaendig, mo && arten(mo)]).toEqual([
      240,
      false,
      ["pause_ende_fehlt"],
    ]);
    expect(mo?.schichten[0]?.offen?.art).toBe("pause_ende");
    expect(di && arten(di)).toEqual(["kommen_fehlt", "kommen_fehlt"]);
  });

  /*
   * Third review of PR #11: a break of 9 h or more ends the shift, so a Kommen or Pause-Ende after
   * it cannot end the break: the shift before was left in its break, as when the stamp comes 24 h
   * after Kommen or is a second Pause. Read as the end of the break, it left Mo complete without any
   * end stamped.
   */
  it("9 h: a Kommen 9 h or more after the break began leaves the break open, „Pause-Ende fehlt“", () => {
    const [mo, di] = tage([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T12:00+01:00"),
      kommen("2026-11-17T07:00+01:00"),
      gehen("2026-11-17T15:00+01:00"),
    ]);
    expect([mo?.arbeitsMinuten, mo?.vollstaendig, mo && arten(mo)]).toEqual([
      240,
      false,
      ["pause_ende_fehlt"],
    ]);
    expect(mo?.schichten[0]?.offen?.art).toBe("pause_ende");
    expect([di?.arbeitsMinuten, di?.vollstaendig, di && arten(di)]).toEqual([480, true, []]);
  });

  it("9 h: a Pause-Ende 9 h or more after the break began does not end it", () => {
    const [mo, di] = tage([
      kommen("2026-11-16T08:00+01:00"),
      pause("2026-11-16T12:00+01:00"),
      weiter("2026-11-17T07:00+01:00"),
      gehen("2026-11-17T15:00+01:00"),
    ]);
    expect([mo?.arbeitsMinuten, mo?.vollstaendig, mo && arten(mo)]).toEqual([
      240,
      false,
      ["pause_ende_fehlt"],
    ]);
    expect([di?.vollstaendig, di && arten(di)]).toEqual([false, ["kommen_fehlt", "kommen_fehlt"]]);
  });

  /*
   * Second review of PR #11: once 24 h have passed since Kommen, no stamp can end the shift any
   * more, so the Gehen is missing for certain. Midnight after the start day can lie later than that
   * when the day has 25 hours (25.10.2026, the clocks go back at 3:00).
   */
  it("24 h: an open shift is a finding 24 h after Kommen at the latest, also on the 25-hour day", () => {
    const kommt = kommen("2026-10-25T00:30+02:00");
    const offen = (jetzt: string) => {
      const ergebnis = arbeitstage([kommt], um(jetzt));
      if (!ergebnis.ok) throw new Error(ergebnis.grund);
      return ergebnis.wert[0];
    };
    expect(offen("2026-10-25T23:29+01:00")?.befunde).toEqual([]);
    expect(offen("2026-10-25T23:30+01:00")?.befunde.map((befund) => befund.art)).toEqual([
      "gehen_fehlt",
    ]);
    expect(offen("2026-10-25T23:30+01:00")?.schichten[0]?.offen?.faellig).toBe(
      kommt.zeitpunkt + 24 * 60 * 60_000,
    );
  });

  /*
   * Third review of PR #11: an end 24 h after Kommen still ends the shift, and a Kommen at the same
   * instant begins the next. With seconds, the end was cut up to the next minute and the start down,
   * so the minute between counted in both shifts. Two shifts never overlap; the minute stays with
   * the next shift, which begins as stamped, so no working time is lost.
   */
  it("24 h: Gehen and Kommen at 8:00:30, 24 h after Kommen – the minute counts once", () => {
    const [mo, di] = tage([
      kommen("2026-11-16T08:00:30+01:00"),
      gehen("2026-11-17T08:00:30+01:00"),
      kommen("2026-11-17T08:00:30+01:00"),
      gehen("2026-11-17T12:00+01:00"),
    ]);
    const erste = mo?.schichten[0];
    const zweite = di?.schichten[0];
    expect([erste?.ende, zweite?.beginn]).toEqual([
      um("2026-11-17T08:00+01:00"),
      um("2026-11-17T08:00+01:00"),
    ]);
    expect([mo?.arbeitsMinuten, di?.arbeitsMinuten]).toEqual([1440, 240]);
  });

  /*
   * Fourth review of PR #11: a break shorter than a minute merged the stretch before it into the
   * open stretch after it, so the work up to the break, stamped at both ends, was no longer
   * counted: 0 minutes where a break of 30 min keeps 4 h (CLAUDE.md: never to the employee's
   * disadvantage; docs/arbeitstag.md: "die Arbeit bis zur Pause zählt").
   */
  it("keeps the work before a break under a minute when the stretch after it is open", () => {
    const laeuft = einTag(
      [
        kommen("2026-11-16T08:00+01:00"),
        pause("2026-11-16T12:00:10+01:00"),
        weiter("2026-11-16T12:00:40+01:00"),
      ],
      um("2026-11-16T13:00+01:00"),
    );
    expect([laeuft.arbeitsMinuten, laeuft.pausenMinuten]).toEqual([241, 0]);
    expect(laeuft.schichten[0]?.pausen).toEqual([]);
    expect(laeuft.schichten[0]?.offen?.art).toBe("gehen");
    const [mo, di] = tage([
      kommen("2026-11-16T08:00:30+01:00"),
      pause("2026-11-17T08:00:10+01:00"),
      weiter("2026-11-17T08:00:20+01:00"),
      kommen("2026-11-17T08:00:40+01:00"),
      gehen("2026-11-17T12:00+01:00"),
    ]);
    expect([mo?.arbeitsMinuten, mo && arten(mo), di?.arbeitsMinuten]).toEqual([
      1440,
      ["gehen_fehlt"],
      240,
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
