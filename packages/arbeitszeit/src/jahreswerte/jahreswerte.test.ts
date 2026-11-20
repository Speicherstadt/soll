import { describe, expect, it } from "vitest";
import { beginnInBerlin } from "../kalender/zeit.ts";
import {
  abschnitte,
  kinderkrankentage,
  mindestlohnAm,
  minijobGrenzeAm,
  minijobGrenzeAus,
  regelversionAm,
} from "./jahreswerte.ts";
import { KINDERKRANKENTAGE, MINDESTLOHN, MINIJOB_GRENZE, REGELVERSIONEN } from "./werte.ts";

const wert = <T>(ergebnis: { ok: true; wert: T } | { ok: false }) =>
  ergebnis.ok ? ergebnis.wert : ergebnis;

describe("the minimum wage on a day", () => {
  it("is the value in force on that day, in cents per hour", () => {
    expect(wert(mindestlohnAm("2024-12-31"))).toBe(1241);
    expect(wert(mindestlohnAm("2025-01-01"))).toBe(1282);
    expect(wert(mindestlohnAm("2026-01-01"))).toBe(1390);
    expect(wert(mindestlohnAm("2026-12-31"))).toBe(1390);
    expect(wert(mindestlohnAm("2027-01-01"))).toBe(1460);
  });

  it("is never the value of the year before when a year has none (CLAUDE.md, Never)", () => {
    expect(mindestlohnAm("2028-01-01")).toEqual({ ok: false, grund: "nicht_hinterlegt" });
    expect(mindestlohnAm("2023-12-31")).toEqual({ ok: false, grund: "nicht_hinterlegt" });
  });

  it("names its source", () => {
    const ergebnis = mindestlohnAm("2026-05-04");
    expect(ergebnis.ok && ergebnis.quelle).toContain("MiLoV5");
  });

  it("refuses what is not a calendar day", () => {
    expect(mindestlohnAm("2026-02-30")).toEqual({ ok: false, grund: "kein_tag" });
  });
});

describe("the mini-job limit", () => {
  it("is the value in force, in cents per month", () => {
    expect(wert(minijobGrenzeAm("2025-06-01"))).toBe(55600);
    expect(wert(minijobGrenzeAm("2026-06-01"))).toBe(60300);
    expect(wert(minijobGrenzeAm("2027-06-01"))).toBe(63300);
    expect(minijobGrenzeAm("2028-01-01")).toEqual({ ok: false, grund: "nicht_hinterlegt" });
  });

  it("follows § 8 Abs. 1a SGB IV: minimum wage × 130 ÷ 3, rounded up to whole euros", () => {
    expect(minijobGrenzeAus(1390)).toBe(60300); // 602,33 € → 603 €
    expect(minijobGrenzeAus(1460)).toBe(63300); // 632,67 € → 633 €
    expect(minijobGrenzeAus(1500)).toBe(65000); // exactly 650 €, nothing to round
  });

  it("agrees in every period with the minimum wage of that period", () => {
    for (const grenze of MINIJOB_GRENZE) {
      const lohn = mindestlohnAm(grenze.von);
      expect(lohn.ok, grenze.von).toBe(true);
      if (lohn.ok) expect(grenze.wert, grenze.von).toBe(minijobGrenzeAus(lohn.wert));
    }
  });
});

describe("the rule version", () => {
  it("is 2026-1 from 1 January 2026 and not stored before", () => {
    expect(wert(regelversionAm("2026-01-01"))).toBe("2026-1");
    expect(wert(regelversionAm("2026-11-20"))).toBe("2026-1");
    expect(regelversionAm("2025-12-31")).toEqual({ ok: false, grund: "nicht_hinterlegt" });
  });
});

describe("the days of leave for a sick child (§ 45 SGB V)", () => {
  it("are 15 per child in 2026 under Abs. 2a and 10 in 2027 under Abs. 2", () => {
    expect(wert(kinderkrankentage(2026))).toEqual({
      jeKind: 15,
      jeKindAlleinerziehend: 30,
      hoechstens: 35,
      hoechstensAlleinerziehend: 70,
    });
    expect(wert(kinderkrankentage(2027))).toEqual({
      jeKind: 10,
      jeKindAlleinerziehend: 20,
      hoechstens: 25,
      hoechstensAlleinerziehend: 50,
    });
    expect(kinderkrankentage(2028)).toEqual({ ok: false, grund: "nicht_hinterlegt" });
  });
});

describe("the tables", () => {
  it.each([
    ["MINDESTLOHN", MINDESTLOHN],
    ["MINIJOB_GRENZE", MINIJOB_GRENZE],
    ["REGELVERSIONEN", REGELVERSIONEN],
  ] as const)(
    "%s runs in order without overlap and names a source for each value",
    (_, tabelle) => {
      tabelle.forEach((eintrag, index) => {
        expect(eintrag.quelle.length).toBeGreaterThan(20);
        if (eintrag.bis !== null) expect(eintrag.bis >= eintrag.von).toBe(true);
        const vorher = tabelle[index - 1];
        if (vorher) expect(vorher.bis !== null && vorher.bis < eintrag.von).toBe(true);
      });
    },
  );

  it("closes every value of an amount at the end of its year, so no year inherits one", () => {
    for (const eintrag of [...MINDESTLOHN, ...MINIJOB_GRENZE]) {
      expect(eintrag.bis?.endsWith("-12-31"), eintrag.von).toBe(true);
    }
    expect(KINDERKRANKENTAGE.every((eintrag) => eintrag.quelle.includes("SGB V"))).toBe(true);
  });
});

const utc = (text: string) => Date.parse(text);

const um = (tag: string, stunde: number) => beginnInBerlin(tag) + stunde * 3_600_000;

describe("splitting a shift at a change of the yearly values", () => {
  it("splits a night shift over 1 January into the old and the new minimum wage", () => {
    const teile = abschnitte(um("2026-12-31", 22), um("2027-01-01", 6), mindestlohnAm);
    expect(teile).toEqual({
      ok: true,
      wert: [
        {
          beginn: um("2026-12-31", 22),
          ende: beginnInBerlin("2027-01-01"),
          minuten: 120,
          wert: { ok: true, wert: 1390, quelle: expect.any(String) },
        },
        {
          beginn: beginnInBerlin("2027-01-01"),
          ende: um("2027-01-01", 6),
          minuten: 360,
          wert: { ok: true, wert: 1460, quelle: expect.any(String) },
        },
      ],
    });
  });

  it("marks the part in a year without a value as not stored, never with the year before", () => {
    const teile = abschnitte(um("2027-12-31", 22), um("2028-01-01", 6), mindestlohnAm);
    expect(teile.ok && teile.wert.map((teil) => [teil.minuten, teil.wert])).toEqual([
      [120, { ok: true, wert: 1460, quelle: expect.any(String) }],
      [360, { ok: false, grund: "nicht_hinterlegt" }],
    ]);
  });

  it("keeps a shift in one piece when the value does not change, also over midnight", () => {
    const teile = abschnitte(um("2026-06-10", 22), um("2026-06-11", 6), mindestlohnAm);
    expect(teile.ok && teile.wert.map((teil) => teil.minuten)).toEqual([480]);
  });

  it("counts the real minutes over the end of summer time", () => {
    // 25.10.2026: 22:00 to 6:00 by the clock is nine hours (docs/regeln.md, S-201)
    const teile = abschnitte(
      um("2026-10-24", 22),
      um("2026-10-24", 22) + 9 * 3_600_000,
      mindestlohnAm,
    );
    expect(teile.ok && teile.wert.map((teil) => teil.minuten)).toEqual([540]);
  });

  it("refuses an end before the start and instants that are not whole minutes", () => {
    expect(abschnitte(um("2026-06-10", 6), um("2026-06-10", 5), mindestlohnAm)).toEqual({
      ok: false,
      grund: "ungueltig",
    });
    expect(abschnitte(um("2026-06-10", 6), um("2026-06-10", 7) + 1, mindestlohnAm)).toEqual({
      ok: false,
      grund: "ungueltig",
    });
  });

  it("counts whole minutes also when midnight was not on a whole minute (before April 1893)", () => {
    // Berlin kept local mean time, UTC+0:53:28, so midnight fell at 23:06:32 UTC
    const wechsel = (tag: string) => ({
      ok: true as const,
      wert: tag < "1892-06-01" ? 1 : 2,
      quelle: "",
    });
    const teile = abschnitte(utc("1892-05-31T12:00:00Z"), utc("1892-06-01T12:00:00Z"), wechsel);
    expect(teile.ok && teile.wert.every((teil) => Number.isInteger(teil.minuten))).toBe(true);
    expect(teile.ok && teile.wert.reduce((summe, teil) => summe + teil.minuten, 0)).toBe(1440);
  });

  it("returns an error instead of throwing for a span past the last day istTag accepts", () => {
    expect(abschnitte(0, 8_640_000_000_000_000, mindestlohnAm)).toEqual({
      ok: false,
      grund: "ungueltig",
    });
  });
});
