import { describe, expect, it } from "vitest";
import { sonntagsruhe } from "./sonntagsruhe.ts";
import { BAYERN, HAMBURG, schicht, tagAb, tage } from "./testhilfen.ts";

const kurz = (befunde: { art: string; tage: string[]; minuten: number }[]) =>
  befunde.map(({ art, tage: betroffen, minuten }) => ({ art, tage: betroffen, minuten }));

describe("R-07: Sonn- und Feiertagsruhe (§§ 9, 10 ArbZG)", () => {
  it("erlaubt: Café mit Ausnahme § 10 Abs. 1 Nr. 4, So 10:00 – 16:00", () => {
    const ergebnis = sonntagsruhe(
      tage(schicht("2026-11-15T10:00+01:00", "2026-11-15T16:00+01:00")),
      {
        standort: HAMBURG,
        ausnahmen: [{ art: "abs1", nummer: 4 }],
      },
    );
    expect(ergebnis).toEqual({ befunde: [], nichtHinterlegt: [] });
  });

  it("Grenze: SHK-Betrieb ohne Ausnahme, Sa 18:00 – 23:59", () => {
    const ergebnis = sonntagsruhe(
      tage(schicht("2026-11-14T18:00+01:00", "2026-11-14T23:59+01:00")),
      {
        standort: HAMBURG,
      },
    );
    expect(ergebnis.befunde).toEqual([]);
  });

  it("Verstoß: SHK-Betrieb ohne Ausnahme, Sa 22:00 – So 0:01, für 1 min am Sonntag", () => {
    const ergebnis = sonntagsruhe(
      tage(schicht("2026-11-14T22:00+01:00", "2026-11-15T00:01+01:00")),
      {
        standort: HAMBURG,
      },
    );
    expect(ergebnis.befunde).toEqual([
      {
        regel: "R-07",
        norm: "§ 9 Abs. 1 ArbZG",
        schwere: "verstoss",
        art: "sonntagsarbeit",
        tage: ["2026-11-15"],
        minuten: 1,
        ueber: 1,
        feiertag: null,
      },
    ]);
  });

  it("Verstoß: SHK in Bayern, 6.1.2026 (Heilige Drei Könige), 8:00 – 12:00", () => {
    const tag = tage(schicht("2026-01-06T08:00+01:00", "2026-01-06T12:00+01:00"));
    const { befunde } = sonntagsruhe(tag, { standort: BAYERN });
    expect(befunde).toMatchObject([
      {
        art: "feiertagsarbeit",
        tage: ["2026-01-06"],
        minuten: 240,
        feiertag: "Heilige Drei Könige",
      },
    ]);
    // in Hamburg the 6th of January is a Werktag
    expect(sonntagsruhe(tag, { standort: HAMBURG }).befunde).toEqual([]);
  });

  it("Heiligabend: 24.12.2026 is no legal holiday, 8:00 – 16:00 is allowed", () => {
    const tag = tage(schicht("2026-12-24T08:00+01:00", "2026-12-24T16:00+01:00"));
    expect(sonntagsruhe(tag, { standort: HAMBURG }).befunde).toEqual([]);
  });

  it("Weihnachten: a night shift 24.12. 22:00 – 25.12. 6:00 breaks the rest of the 25th for 6 h", () => {
    const tag = tage(schicht("2026-12-24T22:00+01:00", "2026-12-25T06:00+01:00"));
    expect(kurz(sonntagsruhe(tag, { standort: HAMBURG }).befunde)).toEqual([
      { art: "feiertagsarbeit", tage: ["2026-12-25"], minuten: 360 },
    ]);
  });

  it("Silvester: 31.12.2026 is no holiday, a night shift into Neujahr counts from 0:00", () => {
    const tag = tage(schicht("2026-12-31T20:00+01:00", "2027-01-01T02:00+01:00"));
    expect(kurz(sonntagsruhe(tag, { standort: HAMBURG }).befunde)).toEqual([
      { art: "feiertagsarbeit", tage: ["2027-01-01"], minuten: 120 },
    ]);
  });

  it("counts the 25 hours of Sunday 25.10.2026 in real minutes", () => {
    // SoZV: the clocks go back at 3:00; 0:00 to 6:00 on the clock are seven hours
    const tag = tage(schicht("2026-10-24T22:00+02:00", "2026-10-25T06:00+01:00"));
    expect(kurz(sonntagsruhe(tag, { standort: HAMBURG }).befunde)).toEqual([
      { art: "sonntagsarbeit", tage: ["2026-10-25"], minuten: 7 * 60 },
    ]);
  });

  it("§ 9 Abs. 2: a rest moved six hours earlier begins on Saturday at 18:00", () => {
    const tag = tage(schicht("2026-11-14T14:00+01:00", "2026-11-14T22:00+01:00"));
    const { befunde } = sonntagsruhe(tag, { standort: HAMBURG, verschiebung: -360 });
    expect(kurz(befunde)).toEqual([{ art: "sonntagsarbeit", tage: ["2026-11-15"], minuten: 240 }]);
    // and leaves Sunday 18:00 to 24:00 to work
    const abends = tage(schicht("2026-11-15T18:00+01:00", "2026-11-15T23:00+01:00"));
    expect(sonntagsruhe(abends, { standort: HAMBURG, verschiebung: -360 }).befunde).toEqual([]);
  });

  it("§ 9 Abs. 2: a moved rest lasts the 24 hours after its beginning, also on the DST days", () => {
    // § 9 Abs. 2 ArbZG: „wenn für die auf den Beginn der Ruhezeit folgenden 24 Stunden der Betrieb
    // ruht“ (gesetze-im-internet.de/arbzg/__9.html). Moved six hours earlier, the rest of Sunday
    // 29.3.2026 begins Sa 18:00 CET and ends 24 h later at So 19:00 CEST; that of Sunday 25.10.2026
    // begins Sa 18:00 CEST and ends at So 18:00 CET: its 25 hours are more than 24 (see below).
    const optionen = { standort: HAMBURG, verschiebung: -360 };
    const maerz = tage(schicht("2026-03-29T18:00+02:00", "2026-03-29T19:00+02:00"));
    expect(kurz(sonntagsruhe(maerz, optionen).befunde)).toEqual([
      { art: "sonntagsarbeit", tage: ["2026-03-29"], minuten: 60 },
    ]);
    const nachMaerz = tage(schicht("2026-03-29T19:00+02:00", "2026-03-29T20:00+02:00"));
    expect(sonntagsruhe(nachMaerz, optionen).befunde).toEqual([]);
  });

  it("§ 9 Abs. 2: on 25.10. a rest moved six hours earlier still ends at 18:00, not at 17:00", () => {
    // § 9 Abs. 2 ArbZG: „Beginn oder Ende der Sonn- und Feiertagsruhe um bis zu sechs Stunden vor-
    // oder zurückverlegt …, wenn für die auf den Beginn der Ruhezeit folgenden 24 Stunden der Betrieb
    // ruht“ (gesetze-im-internet.de/arbzg/__9.html). The 24 hours are a minimum: Sunday 25.10.2026
    // has 25, and an end at 17:00 would move it seven hours, past the six the law allows.
    const optionen = { standort: HAMBURG, verschiebung: -360 };
    const vorEnde = tage(schicht("2026-10-25T17:00+01:00", "2026-10-25T18:00+01:00"));
    expect(kurz(sonntagsruhe(vorEnde, optionen).befunde)).toEqual([
      { art: "sonntagsarbeit", tage: ["2026-10-25"], minuten: 60 },
    ]);
    const nachEnde = tage(schicht("2026-10-25T18:00+01:00", "2026-10-25T19:00+01:00"));
    expect(sonntagsruhe(nachEnde, optionen).befunde).toEqual([]);
  });

  it("§ 9 Abs. 2: no gap between a moved Sunday rest on 31.10.2027 and Allerheiligen in Bayern", () => {
    // Sunday 31.10.2027 is the end of summer time, Monday 1.11.2027 Allerheiligen (Art. 1 BayFTG):
    // moved six hours earlier, the two rests run from Sa 18:00 to Mo 18:00 without a break
    const optionen = { standort: BAYERN, verschiebung: -360 };
    const luecke = tage(schicht("2027-10-31T17:00+01:00", "2027-10-31T18:00+01:00"));
    expect(kurz(sonntagsruhe(luecke, optionen).befunde)).toEqual([
      { art: "sonntagsarbeit", tage: ["2027-10-31"], minuten: 60 },
    ]);
  });

  it("§ 9 Abs. 2: a move past six hours is no move, the rest stays 0 to 24 Uhr", () => {
    const tag = tage(schicht("2026-11-14T14:00+01:00", "2026-11-14T22:00+01:00"));
    expect(sonntagsruhe(tag, { standort: HAMBURG, verschiebung: -420 }).befunde).toEqual([]);
  });

  it("§ 10 Abs. 3: a bakery may work three hours, not more", () => {
    const optionen = { standort: HAMBURG, ausnahmen: [{ art: "baeckerei" as const }] };
    expect(sonntagsruhe([tagAb("2026-11-15", "5:00", 180)], optionen).befunde).toEqual([]);
    expect(sonntagsruhe([tagAb("2026-11-15", "5:00", 181)], optionen).befunde).toMatchObject([
      { art: "ueber_3h_baeckerei", norm: "§ 10 Abs. 3 ArbZG", minuten: 181, ueber: 1 },
    ]);
  });

  it("§ 13: a permit of the authority allows the days it names", () => {
    const optionen = {
      standort: HAMBURG,
      ausnahmen: [
        {
          art: "bewilligung" as const,
          fundstelle: "Amt für Arbeitsschutz, 3.11.2026",
          tage: new Set(["2026-11-15"]),
        },
      ],
    };
    expect(sonntagsruhe([tagAb("2026-11-15", "8:00", 240)], optionen).befunde).toEqual([]);
    expect(sonntagsruhe([tagAb("2026-11-22", "8:00", 240)], optionen).befunde).toHaveLength(1);
  });

  it("an exception number outside § 10 Abs. 1 Nr. 1 to 16 allows nothing", () => {
    const { befunde } = sonntagsruhe([tagAb("2026-11-15", "8:00", 240)], {
      standort: HAMBURG,
      ausnahmen: [{ art: "abs1", nummer: 17 }],
    });
    expect(befunde).toHaveLength(1);
  });

  it("does not judge a Sunday before the first rule version", () => {
    const ergebnis = sonntagsruhe([tagAb("2025-12-28", "8:00", 240)], { standort: HAMBURG });
    expect(ergebnis).toEqual({ befunde: [], nichtHinterlegt: ["2025-12-28"] });
  });
});
