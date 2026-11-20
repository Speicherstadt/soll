import { describe, expect, it } from "vitest";
import type { Arbeitstag } from "../arbeitstag/arbeitstag.ts";
import { tage } from "../pruefung/testhilfen.ts";
import { bereitschaftstage } from "./bereitschaftstage.ts";
import {
  DI,
  gehen,
  kommen,
  kurz,
  MO,
  mitBereitschaft,
  pause,
  pruefe,
  SPAETER,
  schicht,
  spanne,
  uhr,
  um,
  weiter,
} from "./testhilfen.ts";

/*
 * The working days with Bereitschaft (S-206): shifts cut as S-201 cuts stamped work, nothing counted
 * twice, minutes in the employee's favour, and days of S-201 unchanged when nothing is added.
 */
const alsPruefTag = (tag: Arbeitstag) => ({
  tag: tag.tag,
  schichten: tag.schichten.map(({ tag, beginn, ende, pausen, bloecke, arbeitsMinuten }) => ({
    tag,
    beginn,
    ende,
    pausen,
    bloecke,
    arbeitsMinuten,
    bereitschaft: [],
    bereitschaftsdienst: [],
    einsaetze: [],
  })),
});

describe("bereitschaftstage", () => {
  it("leaves the days of S-201 as they are when nothing is added", () => {
    const stempel = [
      kommen(uhr(MO, "8:00")),
      pause(uhr(MO, "10:00")),
      weiter(uhr(MO, "10:10")), // 10 min: working time
      pause(uhr(MO, "12:00")),
      weiter(uhr(MO, "12:30")),
      gehen(uhr(MO, "14:00")),
      kommen(uhr(MO, "14:20")),
      gehen(uhr(MO, "16:00")),
      kommen(uhr(DI, "22:00")),
      gehen("2026-11-18T06:00+01:00"),
      kommen("2026-10-24T22:00+02:00"),
      gehen("2026-10-25T06:00+01:00"),
    ];
    const s201 = tage(stempel, SPAETER);
    const ergebnis = bereitschaftstage(s201, {});
    expect(ergebnis.ok && ergebnis.wert.map(({ tag, schichten }) => ({ tag, schichten }))).toEqual(
      s201.map(alsPruefTag),
    );
  });

  it("takes its own days again without change", () => {
    const eingabe = {
      bereitschaftsdienste: [spanne(uhr(MO, "16:30"), uhr(MO, "18:00"))],
      einsaetze: [
        spanne(uhr(DI, "2:00"), uhr(DI, "3:00")),
        spanne(uhr(DI, "3:10"), uhr(DI, "3:40")),
      ],
    };
    const erste = mitBereitschaft(schicht(uhr(MO, "8:00"), uhr(MO, "16:00")), eingabe);
    expect(bereitschaftstage(erste)).toEqual({ ok: true, wert: erste });
  });

  it("refuses spans that end before they begin, are not instants or a reaction time that is no minute count", () => {
    const leer = [] as const;
    const falsch = { beginn: um(uhr(MO, "9:00")), ende: um(uhr(MO, "8:00")) };
    expect(bereitschaftstage(leer, { einsaetze: [falsch] })).toEqual({
      ok: false,
      grund: "ungueltig",
    });
    expect(
      bereitschaftstage(leer, { bereitschaftsdienste: [{ beginn: Number.NaN, ende: 0 }] }),
    ).toEqual({ ok: false, grund: "ungueltig" });
    const dienst = spanne(uhr(MO, "18:00"), uhr(DI, "6:00"));
    for (const reaktionMinuten of [-1, 7.5])
      expect(bereitschaftstage(leer, { rufdienste: [{ ...dienst, reaktionMinuten }] })).toEqual({
        ok: false,
        grund: "ungueltig",
      });
  });

  it("counts whole minutes in the employee's favour", () => {
    const eingabe = {
      einsaetze: [{ beginn: um(uhr(MO, "20:00")) + 30_000, ende: um(uhr(MO, "20:59")) + 10_000 }],
    };
    expect(mitBereitschaft([], eingabe)[0]).toMatchObject({
      arbeitsMinuten: 60,
      einsatzMinuten: 60,
    });
  });

  it("joins call-outs less than 15 minutes apart into one, the time between them working time", () => {
    const eingabe = {
      einsaetze: [
        spanne(uhr(MO, "22:00"), uhr(MO, "23:00")),
        spanne(uhr(MO, "23:10"), uhr(DI, "0:10")),
      ],
    };
    const [mo] = mitBereitschaft([], eingabe);
    expect(mo).toMatchObject({ arbeitsMinuten: 130, einsatzMinuten: 130 });
    expect(mo?.schichten[0]?.einsaetze).toHaveLength(1);
  });

  it("makes a call-out less than 15 minutes from a shift part of its work, the rest after it R-05", () => {
    const stempel = [
      ...schicht(uhr(MO, "14:00"), uhr(MO, "20:00")),
      ...schicht(uhr(DI, "6:00"), uhr(DI, "10:00")),
    ];
    const eingabe = { einsaetze: [spanne(uhr(MO, "20:10"), uhr(MO, "20:40"))] };
    expect(mitBereitschaft(stempel, eingabe)[0]).toMatchObject({
      arbeitsMinuten: 400,
      einsatzMinuten: 0,
    });
    expect(kurz(pruefe(stempel, eingabe))).toEqual([
      ["R-04", "pause_fehlt", ["2026-11-16"]],
      ["R-04", "ohne_pause", ["2026-11-16"]],
      ["R-05", "ruhezeit_zu_kurz", ["2026-11-16", "2026-11-17"]],
    ]);
  });

  it("makes a shift that begins less than 15 minutes after a call-out go on from it: no rest between", () => {
    const stempel = schicht(uhr(DI, "8:00"), uhr(DI, "12:00"));
    const eingabe = { einsaetze: [spanne(uhr(DI, "7:00"), uhr(DI, "7:50"))] };
    const [di] = mitBereitschaft(stempel, eingabe);
    expect(di?.schichten).toHaveLength(1);
    expect(di).toMatchObject({ arbeitsMinuten: 300, einsatzMinuten: 0 });
    expect(pruefe(stempel, eingabe).befunde).toEqual([]);
  });

  it("keeps how a break was taken", () => {
    const stempel = [
      kommen(uhr(MO, "8:00")),
      pause(uhr(MO, "12:00")),
      weiter(uhr(MO, "12:30")),
      gehen(uhr(MO, "16:00")),
    ];
    const eingabe = { einsaetze: [spanne(uhr(MO, "22:00"), uhr(MO, "23:00"))] };
    const pausen = mitBereitschaft(stempel, eingabe)[0]?.schichten[0]?.pausen;
    expect(pausen?.map(({ art, minuten, ruhepause }) => [art, minuten, ruhepause])).toEqual([
      ["gestempelt", 30, true],
      ["luecke", 360, true],
    ]);
  });

  it("leaves an open shift as it is and joins nothing to it", () => {
    const s201 = tage([kommen(uhr(MO, "8:00"))], SPAETER);
    const eingabe = { einsaetze: [spanne(uhr(MO, "22:00"), uhr(MO, "23:00"))] };
    const ergebnis = bereitschaftstage(s201, eingabe);
    expect(ergebnis.ok && ergebnis.wert[0]?.schichten.map((s) => [s.beginn, s.ende])).toEqual([
      [um(uhr(MO, "8:00")), null],
      [um(uhr(MO, "22:00")), um(uhr(MO, "23:00"))],
    ]);
    expect(ergebnis.ok && ergebnis.wert[0]?.arbeitsMinuten).toBe(60);
  });

  it("names a day before the first rule version „nicht hinterlegt“ instead of judging it", () => {
    const stempel = schicht("2025-12-31T08:00+01:00", "2025-12-31T12:00+01:00");
    const eingabe = { einsaetze: [spanne("2025-12-30T23:00+01:00", "2025-12-31T00:30+01:00")] };
    expect(pruefe(stempel, eingabe)).toEqual({
      befunde: [],
      nichtHinterlegt: ["2025-12-30", "2025-12-31"],
    });
  });
});
