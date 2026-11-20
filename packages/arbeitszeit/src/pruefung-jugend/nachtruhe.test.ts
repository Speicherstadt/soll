import { describe, expect, it } from "vitest";
import { JUGEND_GRENZEN } from "./grenzen.ts";
import { arbeitsfensterAm, nachtruhe } from "./nachtruhe.ts";
import { CAFE, LEON, MONTAG, mez, schicht, tage } from "./testhilfen.ts";
import type { JugendOptionen } from "./typen.ts";

/* docs/regeln.md, R-19 (cases taken literally) on Mo 16.11.2026 */
const pruefe = (von: string, bis: string, optionen: JugendOptionen) =>
  nachtruhe(tage(schicht(mez(MONTAG, von), mez(MONTAG, bis))), optionen).befunde;

const FUENFZEHN = "2011-01-01";
const SECHZEHN = "2010-01-01";
const DIENSTAG = "2026-11-17";

describe("R-19: Nachtruhe", () => {
  it("erlaubt: 17-year-old apprentice SHK, 7:00 – 16:00 – no finding", () => {
    expect(nachtruhe(tage(schicht(mez(MONTAG, "7:00"), mez(MONTAG, "16:00"))), LEON)).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });

  it("Grenze: SHK, 12:00 – 20:00 – no finding", () => {
    expect(pruefe("12:00", "20:00", LEON)).toEqual([]);
  });

  it("Verstoß: SHK, 12:00 – 20:01 – „nach 20 Uhr“", () => {
    expect(pruefe("12:00", "20:01", LEON)).toEqual([
      {
        regel: "R-19",
        norm: "§ 14 Abs. 1 JArbSchG",
        schwere: "verstoss",
        art: "nachtruhe",
        tage: [MONTAG],
        minuten: 1,
        fenster: { ab: 360, bis: 1200 },
      },
    ]);
  });

  it("Gastronomie: 17-year-old in the Café, 14:00 – 22:00, no Berufsschultag next – no finding", () => {
    expect(pruefe("14:00", "22:00", CAFE)).toEqual([]);
    expect(pruefe("14:00", "22:01", CAFE)).toEqual([expect.objectContaining({ minuten: 1 })]);
  });

  it("Berufsschule: Café, 14:00 – 22:00, Berufsschule from 8:00 the next day – Verstoß", () => {
    const schule = { ...CAFE, berufsschuleVor9: new Set([DIENSTAG]) };
    expect(pruefe("14:00", "22:00", schule)).toEqual([
      expect.objectContaining({ norm: "§ 14 Abs. 4 JArbSchG", minuten: 120 }),
    ]);
  });

  it("ohne Eintrag: Café, 17, 14:00 – 22:00, no Berufsschultage entered – 2:00 after 20 Uhr", () => {
    const { berufsschuleVor9: _, ...ohne } = CAFE;
    expect(pruefe("14:00", "22:00", ohne)).toEqual([
      expect.objectContaining({ norm: "§ 14 Abs. 4 JArbSchG", minuten: 120 }),
    ]);
  });

  it("unter 16: 15-year-old in the Café, 14:00 – 22:00 – 2:00 after 20 Uhr", () => {
    expect(pruefe("14:00", "22:00", { ...CAFE, geburtsdatum: FUENFZEHN })).toEqual([
      expect.objectContaining({ norm: "§ 14 Abs. 1 JArbSchG", minuten: 120 }),
    ]);
  });

  it("Bäckerei: 17-year-old, 4:00 – 12:00 – no finding; at 16 1:00 before 5 Uhr", () => {
    const baeckerei = { ...LEON, branche: "baeckerei" as const };
    expect(pruefe("4:00", "12:00", baeckerei)).toEqual([]);
    expect(pruefe("4:00", "12:00", { ...baeckerei, geburtsdatum: SECHZEHN })).toEqual([
      expect.objectContaining({ minuten: 60, fenster: { ab: 300, bis: 1200 } }),
    ]);
  });

  it("Konditorei: from 5 Uhr also at 17 (§ 14 Abs. 3 names only Bäckereien)", () => {
    expect(pruefe("4:00", "12:00", { ...LEON, branche: "konditorei" })).toEqual([
      expect.objectContaining({ minuten: 60 }),
    ]);
  });

  it("knows the hours of § 14 Abs. 2 by age, industry and setting", () => {
    const g = JUGEND_GRENZEN["2026-1"];
    if (g === undefined) throw new Error("Regelversion 2026-1");
    expect(arbeitsfensterAm(17, { ...LEON, mehrschichtig: true }, g)).toEqual({
      ab: 360,
      bis: 1380,
    });
    expect(arbeitsfensterAm(15, { ...LEON, mehrschichtig: true }, g)).toEqual({
      ab: 360,
      bis: 1200,
    });
    const land = { ...LEON, branche: "landwirtschaft_tierhaltung" as const };
    expect(arbeitsfensterAm(16, land, g)).toEqual({ ab: 360, bis: 1200 });
    expect(arbeitsfensterAm(16, { ...land, landwirtschaft: "ab_5" }, g)).toEqual({
      ab: 300,
      bis: 1200,
    });
    expect(arbeitsfensterAm(16, { ...land, landwirtschaft: "bis_21" }, g)).toEqual({
      ab: 360,
      bis: 1260,
    });
    expect(arbeitsfensterAm(16, { ...LEON, branche: "schausteller" }, g)).toEqual({
      ab: 360,
      bis: 1320,
    });
  });

  it("measures the morning in real minutes on the day the clocks go forward", () => {
    // So 28.3.2027 from 1:30 MEZ to 6:00 MESZ: the clock shows 4:30, real time is 3:30
    const stempel = schicht("2027-03-28T01:30+01:00", "2027-03-28T10:00+02:00");
    const juenger = { ...CAFE, geburtsdatum: SECHZEHN };
    expect(nachtruhe(tage(stempel), juenger).befunde).toEqual([
      expect.objectContaining({ minuten: 210 }),
    ]);
  });
});
