import { describe, expect, it } from "vitest";
import { type Feiertag, feiertagAm as feiertagAmErgebnis, feiertage } from "./feiertage.ts";
import fixtures from "./fixtures/feiertage-2026-2035.json" with { type: "json" };
import { LAENDER, type Region, type Standort } from "./laender.ts";

/** The holiday or null, for a covered year */
const feiertagAm = (tag: string, standort: Standort): Feiertag | null => {
  const ergebnis = feiertagAmErgebnis(tag, standort);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.feiertag;
};

// Source of the lists: the "quelle" field of the fixture file
const liste = (jahr: number, standort: Standort): string[] => {
  const ergebnis = feiertage(jahr, standort);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.feiertage.map((feiertag) => `${feiertag.tag} ${feiertag.schluessel}`);
};

const JAHRE = Array.from({ length: 10 }, (_, i) => 2026 + i);

describe("feiertage of the 16 Länder, 2026 to 2035", () => {
  for (const land of LAENDER) {
    it(land, () => {
      const erwartet = (fixtures.laender as Record<string, Record<string, string[]>>)[land] ?? {};
      for (const jahr of JAHRE)
        expect(liste(jahr, { land }), `${land} ${jahr}`).toEqual(erwartet[jahr]);
    });
  }
});

describe("regional holidays", () => {
  const faelle: [string, Standort][] = [
    ["BY augsburg katholisch", { land: "BY", regionen: ["augsburg", "katholisch"] }],
    ["SN fronleichnam", { land: "SN", regionen: ["fronleichnam_sachsen"] }],
    ["TH fronleichnam", { land: "TH", regionen: ["fronleichnam_thueringen"] }],
  ];
  for (const [schluessel, standort] of faelle) {
    it(schluessel, () => {
      const erwartet =
        (fixtures.regionen as Record<string, Record<string, string[]>>)[schluessel] ?? {};
      for (const jahr of JAHRE)
        expect(liste(jahr, standort), `${schluessel} ${jahr}`).toEqual(erwartet[jahr]);
    });
  }

  it("leaves them out without the region", () => {
    expect(feiertagAm("2026-08-08", { land: "BY" })).toBeNull();
    expect(feiertagAm("2026-08-15", { land: "BY" })).toBeNull();
    expect(feiertagAm("2026-06-04", { land: "SN" })).toBeNull();
  });

  it("ignores a region of another Land", () => {
    const fremd = ["augsburg"] as Region[];
    expect(feiertagAm("2026-08-08", { land: "HE", regionen: fremd })).toBeNull();
  });

  it("ignores the Fronleichnam region of the other Land between Saxony and Thuringia", () => {
    const sachsen = ["fronleichnam_sachsen"] as Region[];
    const thueringen = ["fronleichnam_thueringen"] as Region[];
    expect(feiertagAm("2026-06-04", { land: "TH", regionen: sachsen })).toBeNull();
    expect(feiertagAm("2026-06-04", { land: "SN", regionen: thueringen })).toBeNull();
  });
});

describe("feiertage", () => {
  it("names the holiday law of the Land", () => {
    expect(feiertagAm("2026-01-06", { land: "BY" })).toEqual({
      tag: "2026-01-06",
      schluessel: "heilige_drei_koenige",
      name: "Heilige Drei Könige",
      norm: "Art. 1 BayFTG",
    });
    expect(feiertagAm("2026-11-18", { land: "SN" })?.norm).toBe("§ 1 SächsSFG");
  });

  it("puts Buß- und Bettag on the Wednesday before 23 November", () => {
    const tage = [2026, 2027, 2028, 2029, 2030].map((jahr) =>
      liste(jahr, { land: "SN" })
        .find((eintrag) => eintrag.endsWith("buss_und_bettag"))
        ?.slice(0, 10),
    );
    expect(tage).toEqual(["2026-11-18", "2027-11-17", "2028-11-22", "2029-11-21", "2030-11-20"]);
  });

  it("knows the one-off Reformationstag 2017 in every Land", () => {
    expect(feiertagAm("2017-10-31", { land: "BY" })?.schluessel).toBe("reformationstag");
    expect(feiertagAm("2016-10-31", { land: "BY" })).toBeNull();
    expect(feiertagAm("2016-10-31", { land: "NI" })).toBeNull();
  });

  it("says nicht hinterlegt for a year before the data", () => {
    expect(feiertage(1994, { land: "HH" })).toEqual({ ok: false, grund: "nicht_hinterlegt" });
    expect(feiertagAmErgebnis("1994-12-25", { land: "HH" })).toEqual({
      ok: false,
      grund: "nicht_hinterlegt",
    });
  });

  it("knows a day without holiday", () => {
    expect(feiertagAm("2026-11-20", { land: "HH" })).toBeNull();
  });
});
