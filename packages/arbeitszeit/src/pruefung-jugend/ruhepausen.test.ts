import { describe, expect, it } from "vitest";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import { jugendRuhepausen } from "./ruhepausen.ts";
import { gehen, kommen, LEON, MONTAG, mez, pause, tage, weiter } from "./testhilfen.ts";

/* docs/regeln.md, R-16 (cases taken literally); every shift starts on Mo 16.11.2026 at 8:00 */
const um = (uhr: string) => mez(MONTAG, uhr);
const pruefe = (stempel: Stempelung[]) => jugendRuhepausen(tage(stempel), LEON);
const arten = (stempel: Stempelung[]) => pruefe(stempel).befunde.map((befund) => befund.art);

describe("R-16: Ruhepausen der Jugendlichen", () => {
  it("erlaubt: 4:30 Arbeit ohne Pause – no finding", () => {
    expect(pruefe([kommen(um("8:00")), gehen(um("12:30"))])).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });

  it("Grenze: 6:01 Arbeit, 60 min Pause in two parts, the first after 1:00 – no finding", () => {
    const stempel = [
      kommen(um("8:00")),
      pause(um("9:00")),
      weiter(um("9:30")),
      pause(um("13:30")),
      weiter(um("14:00")),
      gehen(um("15:01")),
    ];
    expect(arten(stempel)).toEqual([]);
  });

  it("Verstoß: 6:01 Arbeit, 45 min Pause – „Pause fehlt 15 min“", () => {
    const stempel = [
      kommen(um("8:00")),
      pause(um("11:00")),
      weiter(um("11:45")),
      gehen(um("14:46")),
    ];
    expect(pruefe(stempel).befunde).toEqual([
      {
        regel: "R-16",
        norm: "§ 11 Abs. 1 JArbSchG",
        schwere: "verstoss",
        art: "pause_fehlt",
        tage: [MONTAG],
        schicht: Date.parse(um("8:00")),
        fehlt: 15,
      },
    ]);
  });

  it("Verstoß: Pause nach 0:59 Arbeit – „Pause zu früh“", () => {
    const stempel = [kommen(um("8:00")), pause(um("8:59")), weiter(um("9:29")), gehen(um("13:29"))];
    expect(pruefe(stempel).befunde).toEqual([
      expect.objectContaining({
        art: "pause_zu_frueh",
        norm: "§ 11 Abs. 2 Satz 1 JArbSchG",
        abstand: 59,
      }),
    ]);
  });

  it("eine Pause: 1:00 Arbeit, 60 min Pause, 5:01 Arbeit – „über 4:30 ohne Pause“", () => {
    const stempel = [
      kommen(um("8:00")),
      pause(um("9:00")),
      weiter(um("10:00")),
      gehen(um("15:01")),
    ];
    expect(pruefe(stempel).befunde).toEqual([
      expect.objectContaining({
        art: "ohne_pause",
        norm: "§ 11 Abs. 2 Satz 2 JArbSchG",
        ueber: 31,
      }),
    ]);
  });

  it("am Stück: 4:31 Arbeit, 30 min Pause, 0:59 Arbeit – „über 4:30 ohne Pause“ and „Pause zu spät“", () => {
    const stempel = [
      kommen(um("8:00")),
      pause(um("12:31")),
      weiter(um("13:01")),
      gehen(um("14:00")),
    ];
    expect(arten(stempel)).toEqual(["ohne_pause", "pause_zu_spaet"]);
  });

  it("zu spät: 4:00 Arbeit, 30 min Pause, 0:59 Arbeit (4:59) – „Pause zu spät“", () => {
    const stempel = [
      kommen(um("8:00")),
      pause(um("12:00")),
      weiter(um("12:30")),
      gehen(um("13:29")),
    ];
    expect(pruefe(stempel).befunde).toEqual([
      expect.objectContaining({ art: "pause_zu_spaet", abstand: 59 }),
    ]);
  });

  it("does not judge where a voluntary break lies in a shift that owes none", () => {
    const stempel = [kommen(um("8:00")), pause(um("8:30")), weiter(um("8:45")), gehen(um("12:00"))];
    expect(arten(stempel)).toEqual([]);
  });

  it("counts an interruption under 15 minutes as work (§ 11 Abs. 1 Satz 3)", () => {
    const stempel = [
      kommen(um("8:00")),
      pause(um("10:00")),
      weiter(um("10:14")),
      gehen(um("12:44")),
    ];
    expect(arten(stempel)).toEqual(["pause_fehlt", "ohne_pause"]);
  });

  it("leaves an adult's shift to § 4 ArbZG", () => {
    const stempel = [kommen(um("8:00")), gehen(um("14:00"))];
    expect(jugendRuhepausen(tage(stempel), { ...LEON, geburtsdatum: "2008-11-16" })).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });
});
