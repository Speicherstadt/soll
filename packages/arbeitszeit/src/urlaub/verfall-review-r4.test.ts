import { describe, expect, it } from "vitest";
import { plusTage, type Tag } from "../kalender/tag.ts";
import { tage } from "./testhilfen.ts";
import { type BenannterHinweis, type UrlaubskontoEingaben, urlaubskonto } from "./verfall.ts";

/* Review S-708 round 4 (tdd-review): leave a later, late notice named is reported as expiring */

const rng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const int = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const tagIn = (r: () => number, von: Tag, tageAnzahl: number): Tag =>
  plusTage(von, int(r, 0, tageAnzahl - 1));
const zufall = (seed: number): UrlaubskontoEingaben => {
  const r = rng(seed);
  const jahre = [2025, 2026, 2027].map((jahr) => ({
    jahr,
    anspruchHalbtage: int(r, 0, 60),
    ...(r() < 0.2 ? { teilurlaubA: true, uebertragungVerlangt: true } : {}),
  }));
  const genommen = Array.from({ length: int(r, 0, 12) }, () => ({
    tag: tagIn(r, "2025-01-01", 1276),
    halbtage: int(r, 1, 6),
  }));
  const anpassungen = Array.from({ length: int(r, 0, 2) }, () => ({
    jahr: int(r, 2025, 2027),
    halbtage: int(r, -4, 8),
  }));
  const tageSet = new Set<Tag>();
  for (let i = int(r, 0, 4); i > 0; i--) tageSet.add(tagIn(r, "2025-01-01", 1276));
  const benannt: BenannterHinweis[] = [...tageSet].map((tag) => ({
    tag,
    posten: [2025, 2026, 2027]
      .filter((jahr) => jahr <= Number(tag.slice(0, 4)) && r() < 0.8)
      .map((jahr) => ({ jahr, halbtage: int(r, 1, 40) })),
  }));
  return {
    jahre,
    genommen,
    anpassungen,
    benannt,
    hinweise: benannt.map((b) => b.tag),
    heute: tagIn(r, "2025-01-01", 1460),
  };
};

const rechne = (e: UrlaubskontoEingaben) => {
  const k = urlaubskonto(e);
  if (!k.ok) throw new Error(k.grund);
  return k.wert;
};

describe("review r4: a later notice with a later expiry day", () => {
  it("leave a late notice named is not reported as 'Hinweis fehlt'", () => {
    // 2025: 10 days; notice 1.10.2025 names 10; correction +5; notice 2.2.2026 (late) names 15
    const e: UrlaubskontoEingaben = {
      jahre: [{ jahr: 2025, anspruchHalbtage: tage(10) }],
      genommen: [],
      anpassungen: [{ jahr: 2025, halbtage: tage(5) }],
      hinweise: ["2025-10-01", "2026-02-02"],
      benannt: [
        { tag: "2025-10-01", posten: [{ jahr: 2025, halbtage: tage(10) }] },
        { tag: "2026-02-02", posten: [{ jahr: 2025, halbtage: tage(15) }] },
      ],
      heute: "2026-03-02",
    };
    const w = rechne(e);
    const spaeter = rechne({ ...e, heute: "2027-04-01" });
    expect(spaeter.toepfe[0]?.verfallenHalbtage).toBe(tage(15)); // all 15 expire in the end
    const arten = w.befunde.map((b) => `${b.art} ${b.halbtage} ${b.tage[0]}`);
    expect(arten).not.toContain(`hinweis_fehlt ${tage(5)} 2026-03-31`);
  });
});

describe("review r4: what 'Hinweis fällig/fehlt' reports is what never expires without a new notice", () => {
  it("random inputs, notices up to today, nothing else changes", () => {
    const fehler: string[] = [];
    for (let seed = 1; seed <= 3000; seed++) {
      const roh = zufall(seed);
      const benannt = (roh.benannt ?? []).filter((b) => b.tag <= roh.heute);
      const e = {
        ...roh,
        benannt,
        hinweise: benannt.map((b) => b.tag),
        genommen: roh.genommen.filter((g) => g.tag <= roh.heute),
      };
      const jetzt = rechne(e);
      const spaet = rechne({ ...e, heute: "2035-01-01" });
      for (const t of jetzt.toepfe) {
        const ohneHinweis = jetzt.befunde
          .filter(
            (b) => b.jahr === t.jahr && (b.art === "hinweis_faellig" || b.art === "hinweis_fehlt"),
          )
          .reduce((s, b) => s + b.halbtage, 0);
        const bleibt = Math.max(0, spaet.toepfe.find((x) => x.jahr === t.jahr)?.restHalbtage ?? 0);
        if (ohneHinweis !== bleibt)
          fehler.push(`seed ${seed} jahr ${t.jahr}: ohne Hinweis ${ohneHinweis}, bleibt ${bleibt}`);
      }
    }
    expect(fehler.slice(0, 5)).toEqual([]);
  });
});
