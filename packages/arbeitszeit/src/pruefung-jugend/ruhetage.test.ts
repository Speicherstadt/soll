import { describe, expect, it } from "vitest";
import { jugendRuhetage } from "./ruhetage.ts";
import { CAFE, LEON, MONTAG, tagAb, woche } from "./testhilfen.ts";
import type { JugendOptionen } from "./typen.ts";

/* docs/regeln.md, R-20 (cases taken literally); weeks from Mo 16.11.2026 unless the case names one */
const arten = (tage: ReturnType<typeof woche>, optionen: JugendOptionen) =>
  jugendRuhetage(tage, optionen).befunde.map((befund) => befund.art);
const sonntage = (liste: string[]) => liste.map((tag) => tagAb(tag, "10:00", 6 * 60));

describe("R-20: Fünf-Tage-Woche, Samstag, Sonntag, Feiertag", () => {
  it("erlaubt: Mo–Fr gearbeitet – no finding", () => {
    expect(jugendRuhetage(woche(MONTAG, ["8:00", "8:00", "8:00", "8:00", "8:00"]), LEON)).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });

  it("Grenze: Café (Gaststättengewerbe), Di–Sa gearbeitet, Mo frei – no finding", () => {
    expect(arten(woche(MONTAG, ["", "8:00", "8:00", "8:00", "8:00", "8:00"]), CAFE)).toEqual([]);
  });

  it("Verstoß: Mo–Sa gearbeitet – „sechs Arbeitstage“", () => {
    const [befund, ...rest] = jugendRuhetage(
      woche(MONTAG, ["6:00", "6:00", "6:00", "6:00", "6:00", "6:00"]),
      CAFE,
    ).befunde;
    expect(rest).toEqual([]);
    expect(befund).toEqual({
      regel: "R-20",
      norm: "§ 15 Satz 1 JArbSchG",
      schwere: "verstoss",
      art: "ueber_5_tage",
      tage: ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"],
      anzahl: 6,
    });
  });

  it("Verstoß: SHK, Samstag gearbeitet – „Samstag“", () => {
    expect(jugendRuhetage([tagAb("2026-11-21", "8:00", 240)], LEON).befunde).toEqual([
      expect.objectContaining({
        art: "samstag",
        norm: "§ 16 Abs. 1 JArbSchG",
        tage: ["2026-11-21"],
      }),
    ]);
  });

  it("Verstoß: Café, February 2026 (four Sundays), three worked – „mindestens zwei Sonntage frei“", () => {
    expect(
      jugendRuhetage(sonntage(["2026-02-01", "2026-02-08", "2026-02-15"]), CAFE).befunde,
    ).toEqual([
      expect.objectContaining({
        art: "sonntage_frei",
        norm: "§ 17 Abs. 2 Satz 2 JArbSchG",
        tage: ["2026-02-01", "2026-02-08", "2026-02-15"],
        frei: 1,
        sonntage: 4,
      }),
    ]);
  });

  it("fünf Sonntage: Café, November 2026, three worked, two free – no finding", () => {
    expect(arten(sonntage(["2026-11-01", "2026-11-08", "2026-11-15"]), CAFE)).toEqual([]);
    expect(arten(sonntage(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22"]), CAFE)).toEqual(
      ["sonntage_frei"],
    );
  });

  it("Verstoß: Café, 24.12. 10:00 – 14:01 – „nach 14 Uhr“", () => {
    expect(jugendRuhetage([tagAb("2026-12-24", "10:00", 241)], CAFE).befunde).toEqual([
      expect.objectContaining({ art: "nach_14_uhr", norm: "§ 18 Abs. 1 JArbSchG", minuten: 1 }),
    ]);
  });

  it("Heiligabend: Café, Do 24.12.2026 10:00 – 14:00 – no finding; also 31.12.", () => {
    expect(arten([tagAb("2026-12-24", "10:00", 240)], CAFE)).toEqual([]);
    expect(arten([tagAb("2026-12-31", "10:00", 241)], CAFE)).toEqual(["nach_14_uhr"]);
  });

  it("Sonntag: SHK, So 10:00 – 12:00 – „Sonntag“", () => {
    expect(arten([tagAb("2026-11-22", "10:00", 120)], LEON)).toEqual(["sonntag"]);
  });

  it("Feiertag: SHK in Hamburg, Mo 25.5.2026 (Pfingstmontag) 8:00 – 12:00 – „Feiertag“", () => {
    expect(jugendRuhetage([tagAb("2026-05-25", "8:00", 240)], LEON).befunde).toEqual([
      expect.objectContaining({
        art: "feiertag",
        norm: "§ 18 Abs. 1 JArbSchG",
        feiertag: "Pfingstmontag",
      }),
    ]);
    expect(arten([tagAb("2026-05-25", "8:00", 240)], CAFE)).toEqual([]);
  });

  it("25. Dezember: Café, Fr 25.12.2026 10:00 – 14:00 – „Feiertag“ also in the Gaststättengewerbe", () => {
    expect(jugendRuhetage([tagAb("2026-12-25", "10:00", 240)], CAFE).befunde).toEqual([
      expect.objectContaining({ art: "feiertag", norm: "§ 18 Abs. 2 JArbSchG" }),
    ]);
  });

  it("Ostersonntag: Café in Hamburg, So 5.4.2026 – „Feiertag“, though no holiday in Hamburg", () => {
    expect(jugendRuhetage([tagAb("2026-04-05", "10:00", 240)], CAFE).befunde).toEqual([
      expect.objectContaining({ art: "feiertag", norm: "§ 18 Abs. 2 JArbSchG", feiertag: null }),
    ]);
  });

  it("counts the calendar day a shift reaches into", () => {
    // mehrschichtig until 23 Uhr cannot reach Sunday; a planned shift past midnight still counts
    expect(arten([tagAb("2026-11-21", "20:00", 5 * 60)], CAFE)).toEqual([]);
    expect(arten([tagAb("2026-11-21", "20:00", 5 * 60)], LEON)).toEqual(["samstag", "sonntag"]);
  });

  it("leaves the days after the 18th birthday out", () => {
    const erwachsen = { ...LEON, geburtsdatum: "2008-11-21" };
    expect(
      arten(woche(MONTAG, ["6:00", "6:00", "6:00", "6:00", "6:00", "6:00", "6:00"]), erwachsen),
    ).toEqual([]);
  });
});
