import { describe, expect, it } from "vitest";
import { jugendArbeitszeit } from "./arbeitszeit.ts";
import { CAFE, LEON, MONTAG, woche } from "./testhilfen.ts";
import type { JugendOptionen } from "./typen.ts";

/* docs/regeln.md, R-15 (cases taken literally); weeks from Mo 16.11.2026 unless the case names one */
const arten = (tage: ReturnType<typeof woche>, optionen: JugendOptionen = LEON) =>
  jugendArbeitszeit(tage, optionen).befunde.map((befund) => [befund.art, befund.tage]);

describe("R-15: Arbeitszeit der Jugendlichen", () => {
  it("erlaubt: Mo–Fr je 8:00 (40:00) – no finding", () => {
    expect(
      jugendArbeitszeit(woche(MONTAG, ["8:00", "8:00", "8:00", "8:00", "8:00"]), LEON),
    ).toEqual({ befunde: [], nichtHinterlegt: [] });
  });

  it("Grenze: Mo–Do je 8:30, Fr 6:00 (40:00) – no finding", () => {
    expect(arten(woche(MONTAG, ["8:30", "8:30", "8:30", "8:30", "6:00"]))).toEqual([]);
  });

  it("Verstoß: Mo–Fr je 8:00, Sa 0:30 (40:30) – „über 40 h in der Woche“", () => {
    const [befund, ...rest] = jugendArbeitszeit(
      woche(MONTAG, ["8:00", "8:00", "8:00", "8:00", "8:00", "0:30"]),
      CAFE,
    ).befunde;
    expect(rest).toEqual([]);
    expect(befund).toMatchObject({
      regel: "R-15",
      norm: "§ 8 Abs. 1 JArbSchG",
      schwere: "verstoss",
      art: "ueber_40h",
      minuten: 40 * 60 + 30,
      ueber: 30,
      woche: MONTAG,
    });
    expect(befund?.tage).toHaveLength(6);
  });

  it("Verstoß: Mo 8:31 – „über 8:30“", () => {
    expect(jugendArbeitszeit(woche(MONTAG, ["8:31"]), LEON).befunde).toEqual([
      {
        regel: "R-15",
        norm: "§ 8 Abs. 2a JArbSchG",
        schwere: "verstoss",
        art: "ueber_8_30",
        tage: [MONTAG],
        minuten: 511,
        grenze: 510,
        ueber: 1,
      },
    ]);
  });

  it("kein Ausgleich: Mo–Do je 8:30, Fr frei (34:00) – „über 8 h“ for Mo to Do", () => {
    expect(arten(woche(MONTAG, ["8:30", "8:30", "8:30", "8:30"]))).toEqual([
      ["ueber_8h", ["2026-11-16"]],
      ["ueber_8h", ["2026-11-17"]],
      ["ueber_8h", ["2026-11-18"]],
      ["ueber_8h", ["2026-11-19"]],
    ]);
  });

  it("Feiertag: Hamburg, week of Pfingstmontag 25.5.2026, Di–Do 8:30, Fr 7:00 – 8:00 counted (40:30)", () => {
    const [befund, ...rest] = jugendArbeitszeit(
      woche("2026-05-25", ["", "8:30", "8:30", "8:30", "7:00"]),
      LEON,
    ).befunde;
    expect(rest).toEqual([]);
    expect(befund).toMatchObject({
      art: "ueber_40h",
      norm: "§ 8 Abs. 1, § 4 Abs. 4 Satz 2 JArbSchG",
      minuten: 40 * 60 + 30,
      ausfall: 8 * 60,
      ueber: 30,
    });
  });

  it("Feiertag: the Soll of the day replaces the 8 hours once it is known (S-208)", () => {
    const tage = woche("2026-05-25", ["", "8:30", "8:30", "8:30", "7:00"]);
    expect(arten(tage, { ...LEON, feiertagsausfall: () => 7 * 60 + 30 })).toEqual([]);
  });

  it("Feiertag: a holiday counts nothing when five other days were worked (§ 15)", () => {
    // Café, Pfingstmontag off, Di–Sa 8:00: Monday could not have been a working day
    expect(arten(woche("2026-05-25", ["", "8:00", "8:00", "8:00", "8:00", "8:00"]), CAFE)).toEqual(
      [],
    );
  });

  it("Feiertag: a Saturday holiday counts only where Saturday work is allowed", () => {
    // Sa 1.5.2027 (Tag der Arbeit): Mo–Fr 8:00 is 40:00 for Leon (SHK, no Saturdays)
    const tage = woche("2027-04-26", ["8:00", "8:00", "8:00", "8:00", "7:59"]);
    expect(arten(tage)).toEqual([]);
  });

  it("allows 8:30 only on Werktage: a Sunday or holiday stays at 8 hours (§ 8 Abs. 2a)", () => {
    // „an den übrigen Werktagen derselben Woche achteinhalb Stunden“: Mo 16.11. 6:00, So 22.11. 8:15
    expect(arten(woche(MONTAG, ["6:00", "", "", "", "", "", "8:15"]), CAFE)).toEqual([
      ["ueber_8h", ["2026-11-22"]],
    ]);
    // Hamburg, Pfingstmontag 25.5.2026 8:15 in the Café, Di 26.5. 6:00
    expect(arten(woche("2026-05-25", ["8:15", "6:00"]), CAFE)).toEqual([
      ["ueber_8h", ["2026-05-25"]],
    ]);
  });

  it("Geburtstag: born 16.6.2008, Mo 15.6.2026 and Di 16.6.2026 (18th birthday) 8:31 – only Mo", () => {
    const geboren = { ...LEON, geburtsdatum: "2008-06-16" };
    expect(arten(woche("2026-06-15", ["8:31", "8:31"]), geboren)).toEqual([
      ["ueber_8_30", ["2026-06-15"]],
    ]);
  });

  it("29. Februar: born 29.2.2008, Sa 28.2.2026 and So 1.3.2026 8:31 – only the 28.2.", () => {
    const geboren = { ...LEON, geburtsdatum: "2008-02-29" };
    const tage = woche("2026-02-23", ["", "", "", "", "", "8:31", "8:31"]);
    expect(arten(tage, geboren)).toEqual([["ueber_8_30", ["2026-02-28"]]]);
  });

  it("counts only the days before the 18th birthday into the week", () => {
    // born 19.11.2008: 18 on Thursday, so Mo–Mi 8:00 + Do–Sa are an adult's time
    const geboren = { ...LEON, geburtsdatum: "2008-11-19" };
    expect(arten(woche(MONTAG, ["8:00", "8:00", "8:00", "9:00", "9:00", "9:00"]), geboren)).toEqual(
      [],
    );
  });

  it("checks Sunday's work into the week Monday to Sunday (§ 4 Abs. 4 Satz 1)", () => {
    expect(
      arten(woche(MONTAG, ["8:00", "8:00", "8:00", "8:00", "8:00", "", "0:01"]), CAFE),
    ).toEqual([
      [
        "ueber_40h",
        ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-22"],
      ],
    ]);
    // the next Monday starts a new week
    const zweiWochen = [
      ...woche(MONTAG, ["", "8:00", "8:00", "8:00", "8:00", "8:00"]),
      ...woche("2026-11-23", ["8:00"]),
    ];
    expect(arten(zweiWochen, CAFE)).toEqual([]);
  });

  it("names days before the first rule version as nicht hinterlegt", () => {
    expect(
      jugendArbeitszeit(woche("2025-12-29", ["8:31", "8:31", "8:31", "8:31", "8:31"]), LEON),
    ).toEqual({
      befunde: [
        expect.objectContaining({ art: "ueber_8_30", tage: ["2026-01-01"] }),
        expect.objectContaining({ art: "ueber_8_30", tage: ["2026-01-02"] }),
      ],
      nichtHinterlegt: ["2025-12-29", "2025-12-30", "2025-12-31"],
    });
  });
});
