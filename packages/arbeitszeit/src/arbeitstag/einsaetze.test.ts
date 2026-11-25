import { describe, expect, it } from "vitest";
import { DI, MO, schicht, uhr } from "../pruefung-bereitschaft/testhilfen.ts";
import { type Arbeitstag, arbeitstage, stempelSchluessel, stempeltageMit } from "./arbeitstag.ts";
import type { Einsatzspanne } from "./einsaetze.ts";
import type { Stempelung } from "./stempelungen.ts";
import { gehen, kommen, pause, SPAETER, um, weiter } from "./testhilfen.ts";

/*
 * Call-outs read as the same times stamped (R-12, R-29; reviews of S-505): a call-out is Kommen and
 * Gehen, a running one an open Kommen, read with the stamps by the functions of S-201, so working
 * days, shifts, breaks and findings are those of the same times stamped. Mo is 16.11.2026.
 */
const einsatz = (beginn: string, ende: string | null): Einsatzspanne => ({
  beginn: um(beginn),
  ende: ende === null ? null : um(ende),
});
const lies = (stempel: Stempelung[], einsaetze: Einsatzspanne[], jetzt = SPAETER) => {
  const ergebnis = arbeitstage(stempel, jetzt, einsaetze);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};
const minuten = (tage: readonly Arbeitstag[]) => tage.map((tag) => [tag.tag, tag.arbeitsMinuten]);

describe("arbeitstage with call-outs", () => {
  it("a call-out within 9 hours after a shift belongs to the shift's day", () => {
    const stempel = schicht(uhr(MO, "12:00"), uhr(MO, "18:00"));
    const spanne = einsatz(uhr(DI, "2:00"), uhr(DI, "3:00"));
    expect(minuten(lies(stempel, [spanne]))).toEqual([["2026-11-16", 420]]);
    expect(stempeltageMit(stempel, [spanne]).einsatz(spanne)).toBe("2026-11-16");
  });

  it("a call-out far from other work is a day of its own; a running one is an open shift", () => {
    const tage = lies(
      [],
      [einsatz(uhr(MO, "23:00"), uhr(DI, "0:30")), einsatz(uhr(DI, "20:00"), null)],
    );
    expect(minuten(tage)).toEqual([
      ["2026-11-16", 90],
      ["2026-11-17", 0],
    ]);
    expect(tage[1]?.schichten[0]?.offen?.art).toBe("gehen");
  });

  it("what is stamped at the same time counts once, without a finding", () => {
    const tage = lies(schicht(uhr(MO, "20:00"), uhr(MO, "21:00")), [
      einsatz(uhr(MO, "20:30"), uhr(MO, "21:30")),
    ]);
    expect(minuten(tage)).toEqual([["2026-11-16", 90]]);
    expect(tage[0]?.befunde).toEqual([]);
  });

  it("a call-out right before stamped work: the shift and its stamps belong to its first day", () => {
    // 31.10. 23:30 – 23:50, stamped 1.11. 0:00 – 8:00: 20 + 10 + 480 min of 31 October
    const stempel = schicht("2026-11-01T00:00+01:00", "2026-11-01T08:00+01:00");
    const spanne = einsatz("2026-10-31T23:30+01:00", "2026-10-31T23:50+01:00");
    expect(minuten(lies(stempel, [spanne]))).toEqual([["2026-10-31", 510]]);
    const tage = stempeltageMit(stempel, [spanne]);
    expect(stempel.map((s) => tage.stempel.get(stempelSchluessel(s)))).toEqual([
      "2026-10-31",
      "2026-10-31",
    ]);
  });

  it("stamped work under 9 hours after a call-out goes on its shift, as stamped (R-01)", () => {
    // 15 minutes off are a Ruhepause, not a new shift
    const tage = lies(schicht(uhr(DI, "0:05"), uhr(DI, "3:00")), [
      einsatz(uhr(MO, "23:30"), uhr(MO, "23:50")),
    ]);
    expect(minuten(tage)).toEqual([["2026-11-16", 195]]);
    expect(tage[0]?.pausenMinuten).toBe(15);
  });

  it("a forgotten Gehen stays open: it takes the call-outs within its 24 hours, ends with none", () => {
    const tage = lies(
      [kommen(uhr(MO, "8:00"))],
      [einsatz(uhr(MO, "20:00"), uhr(MO, "21:00")), einsatz(uhr("18", "2:00"), uhr("18", "3:00"))],
    );
    expect(minuten(tage)).toEqual([
      ["2026-11-16", 0],
      ["2026-11-18", 60],
    ]);
    expect(tage[0]?.ende).toBeNull();
  });

  it("a call-out in a stamped break ends it and begins it again, without a finding", () => {
    const tage = lies(
      [
        kommen(uhr(MO, "8:00")),
        pause(uhr(MO, "12:00")),
        weiter(uhr(MO, "13:00")),
        gehen(uhr(MO, "17:00")),
      ],
      [einsatz(uhr(MO, "12:20"), uhr(MO, "12:40"))],
    );
    expect(minuten(tage)).toEqual([["2026-11-16", 500]]);
    expect(tage[0]?.pausenMinuten).toBe(40);
    expect(tage[0]?.befunde).toEqual([]);
  });

  it("a stamp a call-out covers goes to the call-out's shift", () => {
    const stempel = [kommen(uhr(DI, "2:30")), gehen(uhr(DI, "4:00"))];
    const vorher = schicht(uhr(MO, "12:00"), uhr(MO, "18:00"));
    const spanne = einsatz(uhr(DI, "2:00"), uhr(DI, "3:00"));
    const tage = stempeltageMit([...vorher, ...stempel], [spanne]);
    expect(stempel.map((s) => tage.stempel.get(stempelSchluessel(s)))).toEqual([
      "2026-11-16",
      "2026-11-16",
    ]);
    expect(minuten(lies([...vorher, ...stempel], [spanne]))).toEqual([["2026-11-16", 480]]);
  });

  it("marks the blocks that are only call-outs, for the rest (R-12)", () => {
    const tage = lies(schicht(uhr(MO, "12:00"), uhr(MO, "18:00")), [
      einsatz(uhr(DI, "2:00"), uhr(DI, "3:00")),
      einsatz(uhr(MO, "18:05"), uhr(MO, "18:30")),
    ]);
    expect(tage[0]?.schichten[0]?.einsaetze).toEqual([
      { beginn: um(uhr(DI, "2:00")), ende: um(uhr(DI, "3:00")), minuten: 60 },
    ]);
  });

  it("Herbst: 1:30 summer time to 2:30 winter time on 25.10.2026 is two hours", () => {
    expect(
      minuten(lies([], [einsatz("2026-10-25T01:30+02:00", "2026-10-25T02:30+01:00")])),
    ).toEqual([["2026-10-25", 120]]);
  });

  it("refuses a call-out that ends before it begins", () => {
    expect(arbeitstage([], SPAETER, [einsatz(uhr(MO, "3:00"), uhr(MO, "2:00"))]).ok).toBe(false);
  });
});
