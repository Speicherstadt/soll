import { describe, expect, it } from "vitest";
import { freieSonntage, sonntageIm } from "./freie-sonntage.ts";
import { HAMBURG, istSonntag, tagAb, tageVonBis } from "./testhilfen.ts";

const SONNTAGE_2026 = tageVonBis("2026-01-01", "2026-12-31", istSonntag);
const gearbeitet = (anzahl: number) =>
  SONNTAGE_2026.slice(0, anzahl).map((tag) => tagAb(tag, "10:00", 360));

describe("R-08: Beschäftigungsfreie Sonntage (§ 11 Abs. 1 ArbZG)", () => {
  it("counts 52 Sundays in 2026 and 53 in 2023 (begins on a Sunday) and 2028 (leap year from Saturday)", () => {
    expect(SONNTAGE_2026).toHaveLength(52);
    expect(sonntageIm(2026)).toBe(52);
    expect(sonntageIm(2023)).toBe(53);
    expect(sonntageIm(2028)).toBe(53);
  });

  it("erlaubt: 30 Sonntage mit Arbeit", () => {
    expect(freieSonntage(gearbeitet(30), { standort: HAMBURG })).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });

  it("Grenze: 37 Sonntage mit Arbeit, 15 frei: Hinweis „kein weiterer Sonntag mehr“", () => {
    expect(freieSonntage(gearbeitet(37), { standort: HAMBURG }).befunde).toEqual([
      {
        regel: "R-08",
        norm: "§ 11 Abs. 1 ArbZG",
        schwere: "hinweis",
        art: "kein_sonntag_mehr",
        tage: [SONNTAGE_2026[36]],
        jahr: 2026,
        sonntage: 52,
        gearbeitet: 37,
        hoechstens: 37,
      },
    ]);
  });

  it("Verstoß: 38 Sonntage mit Arbeit", () => {
    const { befunde } = freieSonntage(gearbeitet(38), { standort: HAMBURG });
    expect(befunde.map(({ schwere, art, tage }) => ({ schwere, art, tage }))).toEqual([
      { schwere: "hinweis", art: "kein_sonntag_mehr", tage: [SONNTAGE_2026[36]] },
      { schwere: "verstoss", art: "zu_wenig_freie_sonntage", tage: [SONNTAGE_2026[37]] },
    ]);
  });

  it("counts a Sunday touched by a night shift from Saturday, and each year on its own", () => {
    const liste = [
      ...SONNTAGE_2026.slice(0, 36).map((tag) => tagAb(tag, "10:00", 360)),
      tagAb("2026-12-26", "22:00", 480),
      tagAb("2027-01-03", "10:00", 360),
    ];
    const { befunde } = freieSonntage(liste, { standort: HAMBURG });
    expect(befunde.map(({ art, tage }) => ({ art, tage }))).toEqual([
      { art: "kein_sonntag_mehr", tage: ["2026-12-27"] },
    ]);
  });
});
