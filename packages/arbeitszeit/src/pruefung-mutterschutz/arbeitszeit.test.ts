import { describe, expect, it } from "vitest";
import { mutterschutzArbeitszeit } from "./arbeitszeit.ts";
import { gehen, kommen, LEA, MONTAG, mez, pause, tage, weiter, woche } from "./testhilfen.ts";
import type { MutterschutzOptionen } from "./typen.ts";

/* docs/regeln.md, R-21 (cases taken literally), § 4 Abs. 1 Satz 1 to 3 MuSchG */
const arten = (liste: ReturnType<typeof woche>, optionen: MutterschutzOptionen = LEA) =>
  mutterschutzArbeitszeit(liste, optionen).befunde.map((befund) => [befund.art, befund.tage]);

/** Two weeks from Mo 16.11.2026: ten days of 8:30 and Saturday `samstag` */
const zweiWochen = (samstag: string) => [
  ...woche(MONTAG, ["8:30", "8:30", "8:30", "8:30", "8:30", samstag]),
  ...woche("2026-11-23", ["8:30", "8:30", "8:30", "8:30", "8:30"]),
];

describe("R-21: Arbeitszeit in der Schwangerschaft und Stillzeit", () => {
  it("erlaubt: Mo 8:00 – 16:30 mit 30 min Pause (8:00) – no finding", () => {
    const stempel = [
      kommen(mez(MONTAG, "8:00")),
      pause(mez(MONTAG, "12:00")),
      weiter(mez(MONTAG, "12:30")),
      gehen(mez(MONTAG, "16:30")),
    ];
    expect(mutterschutzArbeitszeit(tage(stempel), LEA)).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });

  it("Grenze: Arbeitszeit 8:30 an einem Tag, Doppelwoche 90:00 – no finding", () => {
    expect(arten(zweiWochen("5:00"))).toEqual([]);
  });

  it("Verstoß: Arbeitszeit 8:31 – „über 8:30“", () => {
    expect(mutterschutzArbeitszeit(woche(MONTAG, ["8:31"]), LEA).befunde).toEqual([
      {
        regel: "R-21",
        norm: "§ 4 Abs. 1 Satz 1 MuSchG",
        schwere: "verstoss",
        art: "ueber_8_30",
        tage: [MONTAG],
        minuten: 511,
        grenze: 510,
        ueber: 1,
      },
    ]);
  });

  it("Verstoß: Doppelwoche 90:01 – „über 90 h in der Doppelwoche“", () => {
    const [befund, ...rest] = mutterschutzArbeitszeit(zweiWochen("5:01"), LEA).befunde;
    expect(rest).toEqual([]);
    expect(befund).toMatchObject({
      art: "doppelwoche",
      norm: "§ 4 Abs. 1 Satz 1 und 3 MuSchG",
      minuten: 90 * 60 + 1,
      grenze: 90 * 60,
      ueber: 1,
      von: MONTAG,
      bis: "2026-11-29",
    });
    expect(befund?.tage).toHaveLength(11);
  });

  it("unter 18: 17 Jahre, Arbeitszeit 8:01 – „über 8 h“", () => {
    expect(
      mutterschutzArbeitszeit(woche(MONTAG, ["8:01"]), { ...LEA, geburtsdatum: "2009-03-10" })
        .befunde,
    ).toEqual([
      expect.objectContaining({ art: "ueber_8h", norm: "§ 4 Abs. 1 Satz 2 MuSchG", grenze: 480 }),
    ]);
  });

  it("unter 18: 80 hours in the Doppelwoche", () => {
    const jung = { ...LEA, geburtsdatum: "2009-03-10" };
    const zehnTage = [
      ...woche(MONTAG, ["8:00", "8:00", "8:00", "8:00", "8:00"]),
      ...woche("2026-11-23", ["8:00", "8:00", "8:00", "8:00", "8:00"]),
    ];
    expect(arten(zehnTage, jung)).toEqual([]);
    const mehr = [...zehnTage, ...woche("2026-11-28", ["0:01"])];
    expect(mutterschutzArbeitszeit(mehr, jung).befunde).toEqual([
      expect.objectContaining({ art: "doppelwoche", grenze: 80 * 60, ueber: 1 }),
    ]);
  });

  it("without a birth date the limits for women under 18 apply", () => {
    expect(arten(woche(MONTAG, ["8:01"]), { ...LEA, geburtsdatum: null })).toEqual([
      ["ueber_8h", [MONTAG]],
    ]);
  });

  it("Geburtstag: born 16.6.2008, Mo 15.6.2026 and Di 16.6.2026 (18th birthday) 8:01 – only Mo", () => {
    expect(
      arten(woche("2026-06-15", ["8:01", "8:01"]), { ...LEA, geburtsdatum: "2008-06-16" }),
    ).toEqual([["ueber_8h", ["2026-06-15"]]]);
  });

  it("Doppelwoche: 45:00, 45:01, 45:00 in three weeks – both Doppelwochen with the middle week", () => {
    const wochen = [
      ...woche("2026-11-02", ["8:30", "8:30", "8:30", "8:30", "8:30", "2:30"]),
      ...woche("2026-11-09", ["8:30", "8:30", "8:30", "8:30", "8:30", "2:31"]),
      ...woche("2026-11-16", ["8:30", "8:30", "8:30", "8:30", "8:30", "2:30"]),
    ];
    expect(
      mutterschutzArbeitszeit(wochen, LEA).befunde.map((befund) => [befund.von, befund.minuten]),
    ).toEqual([
      ["2026-11-02", 90 * 60 + 1],
      ["2026-11-09", 90 * 60 + 1],
    ]);
  });

  it("counts Sundays into the Doppelwoche (§ 4 Abs. 1 Satz 3)", () => {
    const mitSonntag = [...zweiWochen("5:00"), ...woche("2026-11-29", ["0:01"])];
    expect(arten(mitSonntag).map(([art]) => art)).toEqual(["doppelwoche"]);
  });

  it("counts only the days in a span of the mark", () => {
    const ab = { ...LEA, zeitraeume: [{ von: "2026-11-17", bis: null }] };
    expect(arten(woche(MONTAG, ["9:00", "8:00"]), ab)).toEqual([]);
    expect(arten(woche(MONTAG, ["9:00", "8:31"]), ab)).toEqual([["ueber_8_30", ["2026-11-17"]]]);
  });

  it("names days before the first rule version as nicht hinterlegt", () => {
    const ab2025 = { ...LEA, zeitraeume: [{ von: "2025-01-01", bis: null }] };
    expect(mutterschutzArbeitszeit(woche("2025-12-31", ["9:00", "9:00"]), ab2025)).toEqual({
      befunde: [expect.objectContaining({ tage: ["2026-01-01"] })],
      nichtHinterlegt: ["2025-12-31"],
    });
  });
});
