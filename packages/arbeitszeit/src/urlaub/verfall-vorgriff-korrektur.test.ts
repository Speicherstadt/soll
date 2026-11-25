import { expect, it } from "vitest";
import { verfallHinweis } from "./hinweis.ts";
import { tage } from "./testhilfen.ts";
import { type UrlaubskontoEingaben, urlaubskonto } from "./verfall.ts";

// Review urlaub-vorgriff: a negative correction (the old tool's advance leave, urlaub_korrektur < 0)
// leaves a pot below zero; the next year's notice names and lets expire its full leave
const basis: UrlaubskontoEingaben = {
  jahre: [{ jahr: 2026, anspruchHalbtage: tage(20) }],
  genommen: [],
  anpassungen: [{ jahr: 2025, halbtage: -tage(2) }],
  heute: "2026-10-01",
};

it("a notice names no more than is open, and no more than that expires", () => {
  const vorher = urlaubskonto(basis);
  if (!vorher.ok) throw new Error();
  expect(vorher.wert.restHalbtage).toBe(tage(18)); // the account shows 18 days
  const h = verfallHinweis(basis, "2026-10-01");
  if (!h.ok) throw new Error();
  const genannt = h.wert.reduce((s, p) => s + p.halbtage, 0);
  const nachher = urlaubskonto({
    ...basis,
    hinweise: ["2026-10-01"],
    benannt: [
      { tag: "2026-10-01", posten: h.wert.map(({ jahr, halbtage }) => ({ jahr, halbtage })) },
    ],
    heute: "2027-04-01",
  });
  if (!nachher.ok) throw new Error();
  expect.soft(genannt).toBeLessThanOrEqual(tage(18));
  expect.soft(nachher.wert.restHalbtage).toBeGreaterThanOrEqual(0);
});
