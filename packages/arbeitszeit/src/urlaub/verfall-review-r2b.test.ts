import { describe, expect, it } from "vitest";
import { verfallHinweis } from "./hinweis.ts";
import { tage } from "./testhilfen.ts";
import { type UrlaubskontoEingaben, urlaubskonto } from "./verfall.ts";

/*
 * Review S-708 round 2: docs/konten.md "bleibt dieser Teil, bis ein neuer Hinweis ihn nennt" —
 * a later notice naming the left-over leave must let it expire (late notice: BAG 9 AZR 423/16,
 * end of the next year's March), and must not name an expiry day already past.
 */
const basis: UrlaubskontoEingaben = {
  jahre: [{ jahr: 2026, anspruchHalbtage: tage(20) }],
  genommen: [{ tag: "2026-08-03", halbtage: tage(17) }],
  anpassungen: [{ jahr: 2026, halbtage: tage(1) }],
  hinweise: ["2026-10-01"],
  benannt: [{ tag: "2026-10-01", posten: [{ jahr: 2026, halbtage: tage(3) }] }],
  heute: "2027-05-03",
};

describe("review r2: a new notice for leave left after expiry", () => {
  it("names the left-over day with an expiry day not in the past, and it then expires", () => {
    const neu = verfallHinweis(basis, "2027-05-03");
    if (!neu.ok) throw new Error(neu.grund);
    const posten2026 = neu.wert.find((p) => p.jahr === 2026);
    expect(posten2026?.halbtage).toBe(tage(1));
    expect.soft(posten2026?.verfaelltAm).toBe("2028-03-31");

    const r = urlaubskonto({
      ...basis,
      hinweise: ["2026-10-01", "2027-05-03"],
      benannt: [...(basis.benannt ?? []), { tag: "2027-05-03", posten: neu.wert }],
      heute: "2028-04-03",
    });
    if (!r.ok) throw new Error(r.grund);
    expect.soft(r.wert.toepfe.find((t) => t.jahr === 2026)).toMatchObject({
      verfallenHalbtage: tage(4),
      restHalbtage: 0,
    });
  });
});
