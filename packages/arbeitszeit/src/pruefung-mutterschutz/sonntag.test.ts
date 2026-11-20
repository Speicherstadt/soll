import { describe, expect, it } from "vitest";
import { mutterschutzSonntag } from "./sonntag.ts";
import { LEA, tagAb } from "./testhilfen.ts";
import type { MutterschutzOptionen } from "./typen.ts";

/*
 * docs/regeln.md, R-21 (cases taken literally), § 6 Abs. 1 MuSchG: So 15.11.2026 in the week
 * Mo 9.11. to So 15.11.
 */
const CAFE: MutterschutzOptionen = { ...LEA, ausnahmen: [{ art: "abs1", nummer: 4 }] };
const ERKLAERT: MutterschutzOptionen = {
  ...CAFE,
  sonntagsbereitschaft: [{ von: "2026-11-01", bis: null }],
};
const SONNTAG = tagAb("2026-11-15", "10:00", 6 * 60);
/** Mi 11.11. to Sa 14.11. 8:00 – 16:00 */
const MI_BIS_SA = ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"].map((tag) =>
  tagAb(tag, "8:00", 8 * 60),
);
const arten = (tage: ReturnType<typeof tagAb>[], optionen: MutterschutzOptionen) =>
  mutterschutzSonntag(tage, optionen).befunde.map((befund) => befund.art);

describe("R-21: Sonn- und Feiertage", () => {
  it("Sonntag: Café with an exception under § 10 Abs. 1 Nr. 4 ArbZG, So 10:00 – 16:00, no declaration", () => {
    expect(mutterschutzSonntag([SONNTAG, tagAb("2026-11-10", "8:00", 60)], CAFE).befunde).toEqual([
      {
        regel: "R-21",
        norm: "§ 6 Abs. 1 MuSchG",
        schwere: "verstoss",
        art: "sonntagsarbeit",
        tage: ["2026-11-15"],
        minuten: 360,
        fehlt: ["erklaerung"],
        feiertag: null,
      },
    ]);
  });

  it("Erklärung: with her declaration, Mo 9.11. 8:00 – 13:00, Di frei, Mi to Sa worked – no finding", () => {
    const tage = [tagAb("2026-11-09", "8:00", 5 * 60), ...MI_BIS_SA, SONNTAG];
    expect(mutterschutzSonntag(tage, ERKLAERT)).toEqual({ befunde: [], nichtHinterlegt: [] });
  });

  it("Nachtruhe: Mo 9.11. until 13:01, 10:59 before the free Di – „Ersatzruhetag fehlt“", () => {
    const tage = [tagAb("2026-11-09", "8:00", 5 * 60 + 1), ...MI_BIS_SA, SONNTAG];
    expect(mutterschutzSonntag(tage, ERKLAERT).befunde).toEqual([
      {
        regel: "R-21",
        norm: "§ 6 Abs. 1 Satz 2 Nr. 3 MuSchG",
        schwere: "verstoss",
        art: "ersatzruhetag_fehlt",
        tage: ["2026-11-15"],
        woche: "2026-11-09",
      },
    ]);
  });

  it("judges the Ersatzruhetag only once the week is over", () => {
    const tage = [tagAb("2026-11-09", "8:00", 5 * 60 + 1), ...MI_BIS_SA, SONNTAG];
    const laufend = { ...ERKLAERT, jetzt: Date.parse("2026-11-15T18:00+01:00") };
    expect(arten(tage, laufend)).toEqual([]);
    const vorbei = { ...ERKLAERT, jetzt: Date.parse("2026-11-16T00:00+01:00") };
    expect(arten(tage, vorbei)).toEqual(["ersatzruhetag_fehlt"]);
  });

  it("ohne Ausnahme: SHK without an exception under § 10 ArbZG, with her declaration – „Sonntag“", () => {
    const shk = { ...LEA, sonntagsbereitschaft: [{ von: "2026-11-01", bis: null }] };
    expect(mutterschutzSonntag([tagAb("2026-11-15", "10:00", 120)], shk).befunde).toEqual([
      expect.objectContaining({ art: "sonntagsarbeit", fehlt: ["ausnahme"] }),
    ]);
  });

  it("a permit under § 13 ArbZG is no exception under § 10 ArbZG", () => {
    const bewilligt: MutterschutzOptionen = {
      ...ERKLAERT,
      ausnahmen: [{ art: "bewilligung", fundstelle: "HH 11/2026" }],
    };
    expect(mutterschutzSonntag([SONNTAG], bewilligt).befunde[0]).toMatchObject({
      fehlt: ["ausnahme"],
    });
  });

  it("Feiertag: Hamburg, Fr 25.12.2026 8:00 – 12:00, no declaration – „Feiertag“", () => {
    expect(mutterschutzSonntag([tagAb("2026-12-25", "8:00", 240)], LEA).befunde[0]).toEqual({
      regel: "R-21",
      norm: "§ 6 Abs. 1 MuSchG",
      schwere: "verstoss",
      art: "feiertagsarbeit",
      tage: ["2026-12-25"],
      minuten: 240,
      fehlt: ["erklaerung", "ausnahme"],
      feiertag: "1. Weihnachtstag",
    });
  });

  it("counts the part of a Saturday night shift in the Sunday, 0 to 24 Uhr", () => {
    expect(arten([tagAb("2026-11-14", "18:00", 6 * 60 + 1)], CAFE)).toContain("sonntagsarbeit");
    expect(arten([tagAb("2026-11-14", "18:00", 6 * 60)], CAFE)).toEqual([]);
  });

  it("leaves Sundays outside the span of the mark alone", () => {
    const ohne = { ...CAFE, zeitraeume: [{ von: "2026-11-16", bis: null }] };
    expect(arten([SONNTAG], ohne)).toEqual([]);
  });
});
