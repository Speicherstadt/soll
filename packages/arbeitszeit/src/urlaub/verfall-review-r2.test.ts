import { describe, expect, it } from "vitest";
import { tage } from "./testhilfen.ts";
import { type UrlaubskontoEingaben, urlaubskonto } from "./verfall.ts";

/* Review S-708 round 2: only leave a notice named and that is still open may expire (EuGH C-684/16) */
const konto = (e: Partial<UrlaubskontoEingaben>) => {
  const r = urlaubskonto({
    jahre: [{ jahr: 2026, anspruchHalbtage: tage(20) }],
    genommen: [{ tag: "2026-08-03", halbtage: tage(17) }],
    heute: "2027-04-01",
    ...e,
  });
  if (!r.ok) throw new Error(r.grund);
  return r.wert;
};

describe("review r2: named leave, partly taken, then leave added", () => {
  it("notice 1.10.2026 names 3 days; 1 day taken in Nov; correction +1 day: 2 expire, 1 stays", () => {
    const wert = konto({
      genommen: [
        { tag: "2026-08-03", halbtage: tage(17) },
        { tag: "2026-11-02", halbtage: tage(1) },
      ],
      anpassungen: [{ jahr: 2026, halbtage: tage(1) }],
      hinweise: ["2026-10-01"],
      benannt: [{ tag: "2026-10-01", posten: [{ jahr: 2026, halbtage: tage(3) }] }],
    });
    // named 3, of them 1 taken: 2 named and open; the added day was never named
    expect(wert.toepfe[0]).toMatchObject({ verfallenHalbtage: tage(2), restHalbtage: tage(1) });
  });

  it("second notice names less (after taking), then a correction: max of both notices must not apply", () => {
    const wert = konto({
      genommen: [
        { tag: "2026-08-03", halbtage: tage(17) },
        { tag: "2026-11-02", halbtage: tage(1) },
      ],
      anpassungen: [{ jahr: 2026, halbtage: tage(1) }],
      hinweise: ["2026-10-01", "2026-12-01"],
      benannt: [
        { tag: "2026-10-01", posten: [{ jahr: 2026, halbtage: tage(3) }] },
        { tag: "2026-12-01", posten: [{ jahr: 2026, halbtage: tage(2) }] },
      ],
    });
    expect(wert.toepfe[0]).toMatchObject({ verfallenHalbtage: tage(2), restHalbtage: tage(1) });
  });

  it("a notice naming carry-over and the current year, partly taken: named open leave expires", () => {
    const wert = konto({
      jahre: [
        { jahr: 2025, anspruchHalbtage: tage(10) },
        { jahr: 2026, anspruchHalbtage: tage(20) },
      ],
      genommen: [
        { tag: "2025-06-02", halbtage: tage(5) },
        { tag: "2026-06-01", halbtage: tage(8) },
      ],
      hinweise: ["2026-02-02"],
      benannt: [
        {
          tag: "2026-02-02",
          posten: [
            { jahr: 2025, halbtage: tage(5) },
            { jahr: 2026, halbtage: tage(20) },
          ],
        },
      ],
    });
    expect(wert.toepfe.map((t) => [t.jahr, t.verfallenHalbtage, t.restHalbtage])).toEqual([
      [2025, 0, 0],
      [2026, tage(17), 0],
    ]);
  });
});
