import { describe, expect, it } from "vitest";
import { nachtSonntagBefunde } from "./nacht-sonntag.ts";
import { am, HAMBURG, schicht, tagAb, tage } from "./testhilfen.ts";

describe("§§ 2, 6, 9 to 11 ArbZG together", () => {
  it("orders the findings by day and R-06 to R-09 within a day", () => {
    // the Werktage before Sunday 15.11. are free: R-09 has its Ersatzruhetag on Monday 2.11.
    const liste = [
      ...tage(schicht("2026-11-14T21:00+01:00", "2026-11-15T07:30+01:00")),
      tagAb("2026-11-15", "10:00", 120),
    ];
    const { befunde, nichtHinterlegt } = nachtSonntagBefunde(liste, {
      jetzt: am("2026-11-17"),
      standort: HAMBURG,
      wechselschicht: true,
    });
    expect(
      befunde.map(({ regel, art, tage: betroffen }) => ({ regel, art, tage: betroffen })),
    ).toEqual([
      { regel: "R-06", art: "nacht_ueber_10h", tage: ["2026-11-14"] },
      { regel: "R-07", art: "sonntagsarbeit", tage: ["2026-11-15"] },
    ]);
    expect(nichtHinterlegt).toEqual([]);
  });

  it("names the days no rule version covers once", () => {
    const { befunde, nichtHinterlegt } = nachtSonntagBefunde([tagAb("2025-12-28", "22:00", 600)], {
      jetzt: am("2026-01-10"),
      standort: HAMBURG,
    });
    expect(befunde).toEqual([]);
    expect(nichtHinterlegt).toEqual(["2025-12-28"]);
  });
});
