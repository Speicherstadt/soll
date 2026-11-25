import { describe, expect, it } from "vitest";
import { tage } from "../pruefung/testhilfen.ts";
import { DI, kommen, MO, SPAETER, schicht, uhr, um } from "./testhilfen.ts";
import { einsatzTag, mitEinsaetzen } from "./verbunden.ts";

/*
 * The working days with call-outs as the record of times reads them (R-12, reviews of S-505): a
 * joined shift, call-out and stamped work under 9 hours apart after work or under 15 minutes before
 * it, belongs to the day it begins on, as the same times stamped would (CLAUDE.md, "Time"); what is
 * stamped at the same time counts once. Mo is 16.11.2026.
 */
const einsatz = (beginn: string, ende: string | null) => ({
  beginn: um(beginn),
  ende: ende === null ? null : um(ende),
});
const minuten = (ergebnis: ReturnType<typeof mitEinsaetzen>) =>
  ergebnis.tage.map((tag) => [tag.tag, tag.arbeitsMinuten]);

describe("mitEinsaetzen", () => {
  it("a call-out after a shift within 9 hours belongs to the shift's day", () => {
    const gestempelt = tage(schicht(uhr(MO, "12:00"), uhr(MO, "18:00")), SPAETER);
    const ergebnis = mitEinsaetzen(gestempelt, [einsatz(uhr(DI, "2:00"), uhr(DI, "3:00"))]);
    expect(minuten(ergebnis)).toEqual([["2026-11-16", 420]]);
    expect(ergebnis.tagVon(um(uhr(DI, "2:00")))).toBe("2026-11-16");
  });

  it("a call-out far from other work is a day of its own; a running one counts nothing yet", () => {
    const ergebnis = mitEinsaetzen(
      [],
      [einsatz(uhr(MO, "23:00"), uhr(DI, "0:30")), einsatz(uhr(DI, "20:00"), null)],
    );
    expect(minuten(ergebnis)).toEqual([["2026-11-16", 90]]);
    expect(einsatzTag(ergebnis, einsatz(uhr(DI, "20:00"), null))).toBe("2026-11-17");
  });

  it("what is stamped at the same time counts once", () => {
    const gestempelt = tage(schicht(uhr(MO, "20:00"), uhr(MO, "21:00")), SPAETER);
    const ergebnis = mitEinsaetzen(gestempelt, [einsatz(uhr(MO, "20:30"), uhr(MO, "21:30"))]);
    expect(minuten(ergebnis)).toEqual([["2026-11-16", 90]]);
  });

  it("a call-out right before stamped work joins it: the shift and its stamps belong to its first day", () => {
    // 31.10. 23:30 – 23:50, stamped 1.11. 0:00 – 8:00: 20 + 10 + 480 min of 31 October
    const gestempelt = tage(schicht("2026-11-01T00:00+01:00", "2026-11-01T08:00+01:00"), SPAETER);
    const ergebnis = mitEinsaetzen(gestempelt, [
      einsatz("2026-10-31T23:30+01:00", "2026-10-31T23:50+01:00"),
    ]);
    expect(minuten(ergebnis)).toEqual([["2026-10-31", 510]]);
    expect(ergebnis.tagVon(um("2026-11-01T00:00+01:00"))).toBe("2026-10-31");
  });

  it("a gap of 15 min or more after a call-out begins a shift of its own", () => {
    const gestempelt = tage(schicht(uhr(DI, "0:05"), uhr(DI, "3:00")), SPAETER);
    const ergebnis = mitEinsaetzen(gestempelt, [einsatz(uhr(MO, "23:30"), uhr(MO, "23:50"))]);
    expect(minuten(ergebnis)).toEqual([
      ["2026-11-16", 20],
      ["2026-11-17", 175],
    ]);
  });

  it("a forgotten Gehen stays open and takes no later call-out (R-01)", () => {
    const gestempelt = tage([kommen(uhr(MO, "8:00"))], SPAETER);
    const ergebnis = mitEinsaetzen(gestempelt, [
      { beginn: um(uhr("18", "2:00")), ende: um(uhr("18", "3:00")) },
    ]);
    expect(minuten(ergebnis)).toContainEqual(["2026-11-18", 60]);
  });

  it("Herbst: 1:30 summer time to 2:30 winter time on 25.10.2026 is two hours", () => {
    const ergebnis = mitEinsaetzen(
      [],
      [einsatz("2026-10-25T01:30+02:00", "2026-10-25T02:30+01:00")],
    );
    expect(minuten(ergebnis)).toEqual([["2026-10-25", 120]]);
  });

  it("without call-outs the stamped days stay as they are", () => {
    const gestempelt = tage(schicht(uhr(MO, "8:00"), uhr(MO, "16:00")), SPAETER);
    expect(minuten(mitEinsaetzen(gestempelt, []))).toEqual([["2026-11-16", 480]]);
  });
});
