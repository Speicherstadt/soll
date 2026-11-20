import { describe, expect, it } from "vitest";
import { ruhepausen } from "./ruhepausen.ts";
import { arbeit, gehen, kommen, pause, schicht, tage, um, weiter } from "./testhilfen.ts";

/*
 * docs/regeln.md, R-04 (cases taken literally), with the cases of a break over midnight, the DST
 * change and two shifts on one day. Work starts at 8:00; a break of the length the case names lies
 * at 12:00, unless the case says where.
 */
const MO = "2026-11-16";
const am = (uhrzeit: string) => `${MO}T${uhrzeit}+01:00`;

const MINUTE = 60_000;

/** `arbeitsMinuten` of work with one break of `pausenMinuten` at 12:00 (none for 0) */
const tagMit = (arbeitsMinuten: number, pausenMinuten: number) => {
  if (pausenMinuten === 0) return arbeit(am("08:00"), arbeitsMinuten);
  const weiterUm = um(am("12:00")) + pausenMinuten * MINUTE;
  return [
    kommen(am("08:00")),
    pause(am("12:00")),
    { art: "pause_ende" as const, zeitpunkt: weiterUm },
    { art: "gehen" as const, zeitpunkt: weiterUm + (arbeitsMinuten - 240) * MINUTE },
  ];
};

const befundeVon = (stempel: Parameters<typeof tage>[0]) => {
  const ergebnis = ruhepausen(tage(stempel));
  expect(ergebnis.nichtHinterlegt).toEqual([]);
  return ergebnis.befunde;
};

describe("R-04: Ruhepausen", () => {
  it("erlaubt: 6:00 Arbeit, keine Pause – no finding („mehr als sechs“)", () => {
    expect(befundeVon(tagMit(360, 0))).toEqual([]);
  });

  it("Grenze: 6:01 Arbeit, 30 min Pause – no finding", () => {
    expect(befundeVon(tagMit(361, 30))).toEqual([]);
  });

  it("Verstoß: 6:01 Arbeit, 29 min Pause – Verstoß „Pause fehlt 1 min“", () => {
    expect(befundeVon(tagMit(361, 29))).toEqual([
      {
        regel: "R-04",
        norm: "§ 4 Satz 1 ArbZG",
        schwere: "verstoss",
        art: "pause_fehlt",
        tage: [MO],
        schicht: um(am("08:00")),
        arbeitsMinuten: 361,
        pausenMinuten: 29,
        fehlt: 1,
      },
    ]);
  });

  it("Grenze: 9:00 Arbeit, 30 min Pause – no finding („bis zu neun“)", () => {
    expect(befundeVon(tagMit(540, 30))).toEqual([]);
  });

  it("Verstoß: 9:01 Arbeit, 30 min Pause – Verstoß „Pause fehlt 15 min“ („mehr als neun“)", () => {
    expect(befundeVon(tagMit(541, 30))).toEqual([
      expect.objectContaining({ art: "pause_fehlt", arbeitsMinuten: 541, fehlt: 15 }),
    ]);
  });

  it("Grenze: 2 × 15 min Pause bei 8:00 Arbeit – no finding (§ 4 Satz 2)", () => {
    const stempel = [
      kommen(am("08:00")),
      pause(am("10:00")),
      weiter(am("10:15")),
      pause(am("13:00")),
      weiter(am("13:15")),
      gehen(am("16:30")),
    ];
    expect(befundeVon(stempel)).toEqual([]);
  });

  it("Verstoß: 14 min + 16 min Pause bei 8:00 Arbeit – Verstoß; the 14 min count as working time", () => {
    const stempel = [
      kommen(am("08:00")),
      pause(am("10:00")),
      weiter(am("10:14")),
      pause(am("13:00")),
      weiter(am("13:16")),
      gehen(am("16:30")),
    ];
    expect(befundeVon(stempel)).toEqual([
      expect.objectContaining({
        art: "pause_fehlt",
        arbeitsMinuten: 494,
        pausenMinuten: 16,
        fehlt: 14,
      }),
    ]);
  });

  it("Verstoß: 8:00 bis 14:01 ohne Pause, dann 30 min – Verstoß „über 6 h ohne Pause“", () => {
    const stempel = [
      kommen(am("08:00")),
      pause(am("14:01")),
      weiter(am("14:31")),
      gehen(am("16:00")),
    ];
    expect(befundeVon(stempel)).toEqual([
      {
        regel: "R-04",
        norm: "§ 4 Satz 3 ArbZG",
        schwere: "verstoss",
        art: "ohne_pause",
        tage: [MO],
        schicht: um(am("08:00")),
        block: { beginn: um(am("08:00")), ende: um(am("14:01")), minuten: 361 },
        ueber: 1,
      },
    ]);
  });

  it("ohne Pause: 8:00 bis 14:01 ohne Pause – both „Pause fehlt 30 min“ and „über 6 h ohne Pause“", () => {
    expect(befundeVon(arbeit(am("08:00"), 361))).toEqual([
      expect.objectContaining({ norm: "§ 4 Satz 1 ArbZG", art: "pause_fehlt", fehlt: 30 }),
      expect.objectContaining({ norm: "§ 4 Satz 3 ArbZG", art: "ohne_pause", ueber: 1 }),
    ]);
  });
});

describe("R-04: midnight, DST and shifts", () => {
  it("über Mitternacht: Mo 20:00 – Di 4:30, break 23:45 – 0:15 – no finding", () => {
    const stempel = [
      kommen(am("20:00")),
      pause(am("23:45")),
      weiter("2026-11-17T00:15+01:00"),
      gehen("2026-11-17T04:30+01:00"),
    ];
    expect(befundeVon(stempel)).toEqual([]);
  });

  it("Herbst: 22:00 to 5:00 over 25.10.2026 is 8 h of real time without a break", () => {
    const stempel = schicht("2026-10-24T22:00+02:00", "2026-10-25T05:00+01:00");
    expect(befundeVon(stempel)).toEqual([
      expect.objectContaining({ art: "pause_fehlt", tage: ["2026-10-24"], fehlt: 30 }),
      expect.objectContaining({ art: "ohne_pause", tage: ["2026-10-24"], ueber: 120 }),
    ]);
  });

  it("zwei Schichten: 5:00 – 8:00 and 17:00 – 21:00 are judged apart – no finding", () => {
    const stempel = [...schicht(am("05:00"), am("08:00")), ...schicht(am("17:00"), am("21:00"))];
    expect(befundeVon(stempel)).toEqual([]);
  });

  it("counts a gap between two pairs as a Ruhepause like a stamped one", () => {
    const stempel = [...schicht(am("08:00"), am("12:00")), ...schicht(am("12:30"), am("16:30"))];
    expect(befundeVon(stempel)).toEqual([]);
  });

  it("judges an open shift only once it is closed", () => {
    const { befunde } = ruhepausen(tage([kommen(am("08:00"))], um("2026-11-17T12:00+01:00")));
    expect(befunde).toEqual([]);
  });

  it("names a day before the first rule version instead of judging it", () => {
    expect(ruhepausen(tage(arbeit("2025-12-30T08:00+01:00", 500)))).toEqual({
      befunde: [],
      nichtHinterlegt: ["2025-12-30"],
    });
  });
});
