import { describe, expect, it } from "vitest";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import { plusTage } from "../kalender/tag.ts";
import { type RuhezeitOptionen, ruhezeit } from "./ruhezeit.ts";
import { kommen, schicht, tage, um } from "./testhilfen.ts";

/*
 * docs/regeln.md, R-05 (cases taken literally), with the cases of a shift past midnight, the DST
 * changes and the windows of § 5 Abs. 2 ArbZG. Mo is 16.11.2026; the Gastronomie case without
 * balance lies in February 2027, whose calendar month and four weeks from the 1st end together.
 */
const SPAETER = um("2030-01-01T00:00Z");
const tag = (datum: string, uhrzeit: string) => `${datum}T${uhrzeit}+01:00`;

const pruefe = (stempel: Stempelung[], optionen: Partial<RuhezeitOptionen> = {}) =>
  ruhezeit(tage(stempel, SPAETER), { jetzt: SPAETER, ...optionen });

/** A day's work from 14:00 to `ende` on Mo, then from `beginn` on Di until 18:00 */
const moDi = (ende: string, beginn: string) => [
  ...schicht(tag("2026-11-16", "14:00"), ende),
  ...schicht(beginn, tag("2026-11-17", "18:00")),
];

const GASTRO = { branche: "gastronomie_beherbergung" } as const;

describe("R-05: Ruhezeit", () => {
  it("erlaubt: Mo 22:00 – Di 10:00 (12:00) – no finding", () => {
    expect(pruefe(moDi(tag("2026-11-16", "22:00"), tag("2026-11-17", "10:00")))).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });

  it("Grenze: Mo 22:00 – Di 9:00 (11:00) – no finding („mindestens elf“)", () => {
    const { befunde } = pruefe(moDi(tag("2026-11-16", "22:00"), tag("2026-11-17", "09:00")));
    expect(befunde).toEqual([]);
  });

  it("Verstoß: Mo 22:00 – Di 8:59 (10:59) – Verstoß „Ruhezeit 10:59“", () => {
    const { befunde } = pruefe(moDi(tag("2026-11-16", "22:00"), tag("2026-11-17", "08:59")));
    expect(befunde).toEqual([
      {
        regel: "R-05",
        norm: "§ 5 Abs. 1 ArbZG",
        schwere: "verstoss",
        art: "ruhezeit_zu_kurz",
        tage: ["2026-11-16", "2026-11-17"],
        ruhe: {
          beginn: um(tag("2026-11-16", "22:00")),
          ende: um(tag("2026-11-17", "08:59")),
          minuten: 659,
        },
        mindestens: 660,
        fehlt: 1,
      },
    ]);
  });

  describe("Gastronomie: Mo 23:00 – Di 9:00 (10:00), Ausgleich am Do mit 12:00", () => {
    // Di and Mi split shifts until 22:00, so the rest before Mi is 11:00 and before Do 12:00
    const bisMi = [
      ...schicht(tag("2026-11-16", "15:00"), tag("2026-11-16", "23:00")),
      ...schicht(tag("2026-11-17", "09:00"), tag("2026-11-17", "14:00")),
      ...schicht(tag("2026-11-17", "17:00"), tag("2026-11-17", "22:00")),
      ...schicht(tag("2026-11-18", "09:00"), tag("2026-11-18", "14:00")),
      ...schicht(tag("2026-11-18", "17:00"), tag("2026-11-18", "22:00")),
    ];
    const donnerstag = schicht(tag("2026-11-19", "10:00"), tag("2026-11-19", "18:00"));

    it("Hinweis before the balance", () => {
      const jetzt = um(tag("2026-11-19", "09:59"));
      const { befunde } = ruhezeit(tage(bisMi, jetzt), { jetzt, ...GASTRO });
      expect(befunde).toEqual([
        {
          regel: "R-05",
          norm: "§ 5 Abs. 2 ArbZG",
          schwere: "hinweis",
          art: "ruhezeit_verkuerzt",
          tage: ["2026-11-16", "2026-11-17"],
          ruhe: {
            beginn: um(tag("2026-11-16", "23:00")),
            ende: um(tag("2026-11-17", "09:00")),
            minuten: 600,
          },
          mindestens: 600,
          fehlt: 60,
          // the later end of the two windows: four weeks from Mo 16.11. reach past November
          ausgleichBis: "2026-12-13",
        },
      ]);
    });

    it("no finding after the balance", () => {
      const jetzt = um(tag("2026-11-19", "20:00"));
      const { befunde } = ruhezeit(tage([...bisMi, ...donnerstag], jetzt), { jetzt, ...GASTRO });
      expect(befunde).toEqual([]);
    });

    it("no finding once 12 hours have passed since the last Gehen, before the next Kommen", () => {
      const jetzt = um(tag("2026-11-19", "10:00"));
      const { befunde } = ruhezeit(tage(bisMi, jetzt), { jetzt, ...GASTRO });
      expect(befunde).toEqual([]);
    });
  });

  describe("Gastronomie: 10:00 ohne Ausgleich im Kalendermonat", () => {
    // Mo 1.2.2027 until 23:00, Di from 9:00 (10:00 of rest); then every day 10:00 to 23:00 with a
    // break of four hours, so that no rest reaches 12:00 until March
    const februar: Stempelung[] = [
      ...schicht(tag("2027-02-01", "15:00"), tag("2027-02-01", "23:00")),
      ...schicht(tag("2027-02-02", "09:00"), tag("2027-02-02", "14:00")),
      ...schicht(tag("2027-02-02", "18:00"), tag("2027-02-02", "23:00")),
      ...Array.from({ length: 27 }, (_, index) => plusTage("2027-02-03", index)).flatMap(
        (datum) => [
          ...schicht(tag(datum, "10:00"), tag(datum, "14:00")),
          ...schicht(tag(datum, "18:00"), tag(datum, "23:00")),
        ],
      ),
    ];

    it("Hinweis until the end of the month", () => {
      const jetzt = um(tag("2027-02-28", "23:59"));
      const { befunde } = ruhezeit(tage(februar, jetzt), { jetzt, ...GASTRO });
      expect(befunde).toEqual([
        expect.objectContaining({ art: "ruhezeit_verkuerzt", ausgleichBis: "2027-02-28" }),
      ]);
    });

    it("Verstoß am Monatsende", () => {
      const jetzt = um(tag("2027-03-01", "00:00"));
      const { befunde } = ruhezeit(tage(februar, jetzt), { jetzt, ...GASTRO });
      expect(befunde).toEqual([
        expect.objectContaining({
          norm: "§ 5 Abs. 2 ArbZG",
          schwere: "verstoss",
          art: "ruhezeit_ausgleich_fehlt",
          tage: ["2027-02-01", "2027-02-02"],
          ausgleichBis: "2027-02-28",
        }),
      ]);
    });
  });
});

describe("R-05: § 5 Abs. 2 ArbZG in detail", () => {
  it("unter 10 h: Gastronomie, Mo 23:00 – Di 8:59 – Verstoß „Ruhezeit 9:59“", () => {
    const { befunde } = pruefe(
      moDi(tag("2026-11-16", "23:00"), tag("2026-11-17", "08:59")),
      GASTRO,
    );
    expect(befunde).toEqual([
      expect.objectContaining({
        norm: "§ 5 Abs. 2 ArbZG",
        schwere: "verstoss",
        art: "ruhezeit_zu_kurz",
        mindestens: 600,
        fehlt: 1,
      }),
    ]);
  });

  it("ohne Branche: Mo 23:00 – Di 9:00 – Verstoß „Ruhezeit 10:00“", () => {
    const { befunde } = pruefe(moDi(tag("2026-11-16", "23:00"), tag("2026-11-17", "09:00")));
    expect(befunde).toEqual([
      expect.objectContaining({ art: "ruhezeit_zu_kurz", mindestens: 660, fehlt: 60 }),
    ]);
  });

  // Fr 20.11.2026 until 23:00, Sa from 9:00; the next 12-hour rest begins on Di 1.12. at 22:00
  const ueberMonatsende = [
    ...schicht(tag("2026-11-20", "15:00"), tag("2026-11-20", "23:00")),
    ...Array.from({ length: 11 }, (_, index) => plusTage("2026-11-21", index)).flatMap((datum) =>
      schicht(tag(datum, "09:00"), tag(datum, "22:00")),
    ),
    ...schicht(tag("2026-12-03", "12:00"), tag("2026-12-03", "18:00")),
  ];
  const jetzt = um(tag("2026-12-20", "12:00"));

  it("vier Wochen: a balance from 1.12. after a shortening on 20.11. counts without a choice", () => {
    const { befunde } = ruhezeit(tage(ueberMonatsende, jetzt), { jetzt, ...GASTRO });
    expect(befunde).toEqual([]);
  });

  it("Kalendermonat gewählt: the same balance comes too late, Verstoß from 1.12.", () => {
    const { befunde } = ruhezeit(tage(ueberMonatsende, jetzt), {
      jetzt,
      ...GASTRO,
      ausgleich: "kalendermonat",
    });
    expect(befunde).toEqual([
      expect.objectContaining({ art: "ruhezeit_ausgleich_fehlt", ausgleichBis: "2026-11-30" }),
    ]);
  });

  it("vier Wochen gewählt: the window ends 27 days after the day the rest began", () => {
    const { befunde } = ruhezeit(tage(ueberMonatsende, jetzt), {
      jetzt,
      ...GASTRO,
      ausgleich: "vier_wochen",
    });
    expect(befunde).toEqual([]);
  });

  it("je Verkürzung: two shortenings, then one rest of 16:00 – Hinweis for the second", () => {
    const stempel = [
      ...schicht(tag("2026-11-16", "15:00"), tag("2026-11-16", "23:00")),
      ...schicht(tag("2026-11-17", "09:00"), tag("2026-11-17", "23:00")),
      ...schicht(tag("2026-11-18", "09:00"), tag("2026-11-18", "17:00")),
      ...schicht(tag("2026-11-19", "09:00"), tag("2026-11-19", "17:00")),
    ];
    const ende = um(tag("2026-11-19", "20:00"));
    // the rest after Mi is 16:00 and balances the first; the one after Do still runs (3 hours)
    const { befunde } = ruhezeit(tage(stempel, ende), { jetzt: ende, ...GASTRO });
    expect(befunde).toEqual([
      expect.objectContaining({ art: "ruhezeit_verkuerzt", tage: ["2026-11-17", "2026-11-18"] }),
    ]);
  });
});

describe("R-05: midnight, DST and open shifts", () => {
  it("über Mitternacht: Mo 16:00 – Di 0:30, Di 11:00 Kommen – Verstoß „Ruhezeit 10:30“", () => {
    const stempel = [
      ...schicht(tag("2026-11-16", "16:00"), tag("2026-11-17", "00:30")),
      ...schicht(tag("2026-11-17", "11:00"), tag("2026-11-17", "18:00")),
    ];
    expect(pruefe(stempel).befunde).toEqual([
      expect.objectContaining({ tage: ["2026-11-16", "2026-11-17"], fehlt: 30 }),
    ]);
  });

  it("Herbst: 22:00 to 8:00 over 25.10.2026 is 11:00 of rest – no finding", () => {
    const stempel = [
      ...schicht("2026-10-24T14:00+02:00", "2026-10-24T22:00+02:00"),
      ...schicht("2026-10-25T08:00+01:00", "2026-10-25T16:00+01:00"),
    ];
    expect(pruefe(stempel).befunde).toEqual([]);
  });

  it("Frühjahr: 22:00 to 9:00 over 28.03.2027 is 10:00 of rest – Verstoß", () => {
    const stempel = [
      ...schicht("2027-03-27T14:00+01:00", "2027-03-27T22:00+01:00"),
      ...schicht("2027-03-28T09:00+02:00", "2027-03-28T16:00+02:00"),
    ];
    expect(pruefe(stempel).befunde).toEqual([
      expect.objectContaining({ art: "ruhezeit_zu_kurz", fehlt: 60 }),
    ]);
  });

  it("am selben Tag: Mo 0:00 – 4:00, Mo 14:00 – 22:00 (10:00) – Verstoß „Ruhezeit 10:00“", () => {
    // two shifts on one calendar day 10 hours apart are two working days by the 9 hours of S-201;
    // Di 6:00 – 12:00 lies 8 hours after 22:00 and belongs to the second
    const stempel = [
      ...schicht(tag("2026-11-16", "00:00"), tag("2026-11-16", "04:00")),
      ...schicht(tag("2026-11-16", "14:00"), tag("2026-11-16", "22:00")),
      ...schicht(tag("2026-11-17", "06:00"), tag("2026-11-17", "12:00")),
    ];
    expect(pruefe(stempel).befunde).toEqual([
      {
        regel: "R-05",
        norm: "§ 5 Abs. 1 ArbZG",
        schwere: "verstoss",
        art: "ruhezeit_zu_kurz",
        tage: ["2026-11-16"],
        ruhe: {
          beginn: um(tag("2026-11-16", "04:00")),
          ende: um(tag("2026-11-16", "14:00")),
          minuten: 600,
        },
        mindestens: 660,
        fehlt: 60,
      },
    ]);
  });

  it("does not measure the rest after an open shift; its Kommen ends the rest before it", () => {
    const stempel = [
      ...schicht(tag("2026-11-16", "14:00"), tag("2026-11-16", "22:00")),
      kommen(tag("2026-11-17", "08:00")),
      ...schicht(tag("2026-11-18", "08:00"), tag("2026-11-18", "16:00")),
    ];
    expect(pruefe(stempel).befunde).toEqual([
      expect.objectContaining({ tage: ["2026-11-16", "2026-11-17"], fehlt: 60 }),
    ]);
  });

  it("names the day a rest ends on when no rule version covers it", () => {
    const stempel = [
      ...schicht("2025-12-30T14:00+01:00", "2025-12-30T23:00+01:00"),
      ...schicht("2025-12-31T09:00+01:00", "2025-12-31T12:00+01:00"),
    ];
    expect(pruefe(stempel)).toEqual({ befunde: [], nichtHinterlegt: ["2025-12-31"] });
  });

  it("measures the rest after a call-out (R-12): its end begins a rest, its start ends none", () => {
    // a planned shift (S-505) in the shape of PruefSchicht: Mo 14:00 – 20:00, a call-out on Di
    // 2:00 – 3:00 in the same working day by the 9 hours of S-201, then work on Di from 12:00
    const stueck = (von: string, bis: string) => {
      const beginn = um(von);
      const ende = um(bis);
      return { beginn, ende, minuten: (ende - beginn) / 60_000 };
    };
    const arbeit = stueck(tag("2026-11-16", "14:00"), tag("2026-11-16", "20:00"));
    const einsatz = stueck(tag("2026-11-17", "02:00"), tag("2026-11-17", "03:00"));
    const di = stueck(tag("2026-11-17", "12:00"), tag("2026-11-17", "16:00"));
    const tage = [
      {
        tag: "2026-11-16",
        schichten: [
          {
            tag: "2026-11-16",
            beginn: arbeit.beginn,
            ende: einsatz.ende,
            pausen: [],
            bloecke: [arbeit, einsatz],
            arbeitsMinuten: 420,
            einsaetze: [einsatz],
          },
        ],
      },
      {
        tag: "2026-11-17",
        schichten: [{ tag: "2026-11-17", ...di, pausen: [], bloecke: [di], arbeitsMinuten: 240 }],
      },
    ];
    expect(ruhezeit(tage, { jetzt: SPAETER }).befunde).toEqual([
      expect.objectContaining({
        tage: ["2026-11-16", "2026-11-17"],
        ruhe: { beginn: einsatz.ende, ende: di.beginn, minuten: 540 },
        fehlt: 120,
      }),
    ]);
  });
});
