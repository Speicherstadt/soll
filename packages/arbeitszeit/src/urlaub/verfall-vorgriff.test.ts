import { describe, expect, it } from "vitest";
import { verfallHinweis } from "./hinweis.ts";
import { tage } from "./testhilfen.ts";
import { type UrlaubskontoEingaben, urlaubskonto } from "./verfall.ts";

/*
 * Leave taken in advance beyond a year's entitlement (review S-708 round 3, docs/regeln.md R-23):
 * the excess counts against the following year, so only leave actually open can expire
 * (§ 7 Abs. 3 BUrlG).
 */

const rechne = (e: UrlaubskontoEingaben) => {
  const k = urlaubskonto(e);
  if (!k.ok) throw new Error(k.grund);
  return k.wert;
};

describe("R-23: leave taken in advance", () => {
  it("leave taken in advance in 2026 against 2027: expiry of 2027 does not take the advanced days twice", () => {
    const w = rechne({
      jahre: [
        { jahr: 2026, anspruchHalbtage: tage(20) },
        { jahr: 2027, anspruchHalbtage: tage(20) },
      ],
      genommen: [{ tag: "2026-06-01", halbtage: tage(22) }],
      hinweise: ["2027-10-01"],
      benannt: [
        {
          tag: "2027-10-01",
          posten: (() => {
            const h = verfallHinweis(
              {
                jahre: [
                  { jahr: 2026, anspruchHalbtage: tage(20) },
                  { jahr: 2027, anspruchHalbtage: tage(20) },
                ],
                genommen: [{ tag: "2026-06-01", halbtage: tage(22) }],
                heute: "2027-10-01",
              },
              "2027-10-01",
            );
            if (!h.ok) throw new Error(h.grund);
            return h.wert.map(({ jahr, halbtage }) => ({ jahr, halbtage }));
          })(),
        },
      ],
      heute: "2028-04-03",
    });
    // 40 days in all, 22 taken: 18 were open and named at most; the balance must not go below 0
    expect(w.restHalbtage).toBeGreaterThanOrEqual(0);
  });
});
