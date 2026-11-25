import { describe, expect, it } from "vitest";
import { verfallHinweis } from "./hinweis.ts";
import { tage } from "./testhilfen.ts";
import type { UrlaubskontoEingaben } from "./verfall.ts";

/** 2026 with 20 days, of which 17 taken in summer: 3 days left (docs/regeln.md, R-23) */
const REST_3: UrlaubskontoEingaben = {
  jahre: [{ jahr: 2026, anspruchHalbtage: tage(20) }],
  genommen: [{ tag: "2026-08-03", halbtage: tage(17) }],
  heute: "2026-11-20",
};

const hinweis = (tag: string, eingaben: Partial<UrlaubskontoEingaben> = {}) => {
  const ergebnis = verfallHinweis({ ...REST_3, ...eingaben }, tag);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

/*
 * What a notice on leave expiring names (BAULISTE.md S-402; § 7 Abs. 3 BUrlG, EuGH C-684/16, BAG,
 * 19.02.2019, 9 AZR 541/15): every day open on its day, per year, with the day it expires at the end
 * of once the notice is given
 */
describe("verfallHinweis", () => {
  it("in time: on 1.10.2026 it names 3 days of 2026 expiring at the end of 31.3.2027", () => {
    expect(hinweis("2026-10-01")).toEqual([
      { jahr: 2026, halbtage: tage(3), verfaelltAm: "2027-03-31" },
    ]);
  });

  it("on the last day for it, 31.12.2026, still in time", () => {
    expect(hinweis("2026-12-31")).toEqual([
      { jahr: 2026, halbtage: tage(3), verfaelltAm: "2027-03-31" },
    ]);
  });

  it("late, on 15.1.2027: the 3 days of 2026 and the leave of 2027 expire at the end of 31.3.2028", () => {
    expect(
      hinweis("2027-01-15", {
        jahre: [
          { jahr: 2026, anspruchHalbtage: tage(20) },
          { jahr: 2027, anspruchHalbtage: tage(20) },
        ],
      }),
    ).toEqual([
      { jahr: 2026, halbtage: tage(3), verfaelltAm: "2028-03-31" },
      { jahr: 2027, halbtage: tage(20), verfaelltAm: "2028-03-31" },
    ]);
  });

  it("a second notice keeps the day of the first: 2026 noticed in time, again on 10.1.2027", () => {
    expect(
      hinweis("2027-01-10", {
        jahre: [
          { jahr: 2026, anspruchHalbtage: tage(20) },
          { jahr: 2027, anspruchHalbtage: tage(20) },
        ],
        hinweise: ["2026-10-01"],
      }),
    ).toEqual([
      { jahr: 2026, halbtage: tage(3), verfaelltAm: "2027-03-31" },
      { jahr: 2027, halbtage: tage(20), verfaelltAm: "2028-03-31" },
    ]);
  });

  it("names the leave open on its day: leave taken later is still open then", () => {
    expect(
      hinweis("2026-07-01", { genommen: [{ tag: "2026-08-03", halbtage: tage(17) }] }),
    ).toEqual([{ jahr: 2026, halbtage: tage(20), verfaelltAm: "2027-03-31" }]);
  });

  it("nothing open: names nothing", () => {
    expect(
      hinweis("2026-10-01", { genommen: [{ tag: "2026-08-03", halbtage: tage(20) }] }),
    ).toEqual([]);
  });

  it("leave of a later year than the notice is not named", () => {
    expect(
      hinweis("2026-10-01", {
        jahre: [
          { jahr: 2026, anspruchHalbtage: tage(20) },
          { jahr: 2027, anspruchHalbtage: tage(20) },
        ],
      }),
    ).toEqual([{ jahr: 2026, halbtage: tage(3), verfaelltAm: "2027-03-31" }]);
  });

  it("Teilurlaub carried over on request: named with the end of the next year", () => {
    expect(
      hinweis("2026-09-01", {
        jahre: [
          {
            jahr: 2026,
            anspruchHalbtage: tage(8.5),
            teilurlaubA: true,
            uebertragungVerlangt: true,
          },
        ],
        genommen: [],
      }),
    ).toEqual([{ jahr: 2026, halbtage: tage(8.5), verfaelltAm: "2027-12-31" }]);
  });

  it("refuses a day that is none", () => {
    expect(verfallHinweis(REST_3, "2026-02-30")).toEqual({ ok: false, grund: "ungueltig" });
  });
});
