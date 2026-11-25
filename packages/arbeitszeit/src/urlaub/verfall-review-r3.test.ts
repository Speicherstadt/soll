import { describe, expect, it } from "vitest";
import { plusTage, type Tag } from "../kalender/tag.ts";
import { verfallHinweis } from "./hinweis.ts";
import { tage } from "./testhilfen.ts";
import { type BenannterHinweis, type UrlaubskontoEingaben, urlaubskonto } from "./verfall.ts";

/*
 * Review S-708 round 3 (tdd-review): property tests for R-23 expiry (ablauf.ts). Leave taken in
 * advance against the next year is a separate finding on main and gets its own pull request.
 */

const rng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const int = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const tagIn = (r: () => number, von: Tag, tageAnzahl: number): Tag =>
  plusTage(von, int(r, 0, tageAnzahl - 1));
const mischen = <T>(r: () => number, xs: readonly T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = int(r, 0, i);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
};

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

describe("review r3: invariants over random inputs", () => {
  it("balances, no expiry without a notice, at most what was named, independent of order", () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const e = zufall(seed);
      const w = rechne(e);
      const r = rng(seed * 7 + 1);
      const gemischt = rechne({
        ...e,
        jahre: mischen(r, e.jahre),
        genommen: mischen(r, e.genommen),
        anpassungen: mischen(r, e.anpassungen ?? []),
        benannt: mischen(r, e.benannt ?? []),
      });
      expect(gemischt, `seed ${seed}`).toEqual(w);
      // no pot below zero by leave taken unless it was taken beyond all leave Soll knows: then
      // none is open (a correction below zero leaves its own pot below zero, it was not taken)
      if (w.toepfe.some((t) => t.restHalbtage < Math.min(0, t.anspruchHalbtage)))
        expect(
          w.toepfe.filter((t) => t.restHalbtage > 0),
          `seed ${seed}`,
        ).toEqual([]);
      for (const t of w.toepfe) {
        expect(t.genommenHalbtage + t.verfallenHalbtage + t.restHalbtage, `seed ${seed}`).toBe(
          t.anspruchHalbtage,
        );
        expect(t.verfallenHalbtage, `seed ${seed}`).toBeGreaterThanOrEqual(0);
        expect(t.genommenHalbtage, `seed ${seed}`).toBeGreaterThanOrEqual(0);
        const genannt = (e.benannt ?? [])
          .filter((b) => b.tag <= e.heute)
          .flatMap((b) => b.posten.filter((p) => p.jahr === t.jahr))
          .reduce((s, p) => s + p.halbtage, 0);
        expect(t.verfallenHalbtage, `seed ${seed} jahr ${t.jahr}`).toBeLessThanOrEqual(genannt);
        if (t.verfallenHalbtage > 0) {
          const befund = w.befunde.find((b) => b.jahr === t.jahr && b.art === "verfallen");
          expect((befund?.tage[0] ?? "") >= t.verfallstag, `seed ${seed}`).toBe(true);
          expect((befund?.tage[0] ?? "") < e.heute, `seed ${seed}`).toBe(true);
        }
      }
    }
  });

  it("expiry only grows with time when nothing else changes", () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const e = zufall(seed);
      const frueh = rechne(e);
      const spaet = rechne({
        ...e,
        heute: plusTage(e.heute, 400),
        genommen: e.genommen.filter((g) => g.tag <= e.heute),
      });
      for (const t of frueh.toepfe) {
        const s = spaet.toepfe.find((x) => x.jahr === t.jahr);
        expect(s?.verfallenHalbtage ?? 0, `seed ${seed}`).toBeGreaterThanOrEqual(
          t.verfallenHalbtage,
        );
      }
    }
  });

  it("verfall_droht names the half days that then expire (nothing else changes)", () => {
    const fehler: string[] = [];
    for (let seed = 1; seed <= 3000; seed++) {
      const roh = zufall(seed);
      // "nothing else changes": no leave and no notice after today, which would count by then
      const e = {
        ...roh,
        benannt: (roh.benannt ?? []).filter((b) => b.tag <= roh.heute),
        hinweise: (roh.hinweise ?? []).filter((t) => t <= roh.heute),
      };
      const genommen = e.genommen.filter((g) => g.tag <= e.heute);
      const w = rechne({ ...e, genommen });
      for (const b of w.befunde.filter((x) => x.art === "verfall_droht")) {
        // each part names its own day (review r4): compare the end of that day with its start
        const amTag = rechne({ ...e, genommen, heute: b.tage[0] as Tag });
        const vorher = amTag.toepfe.find((t) => t.jahr === b.jahr)?.verfallenHalbtage ?? 0;
        const danach = rechne({ ...e, genommen, heute: plusTage(b.tage[0] as Tag, 1) });
        const nachher = danach.toepfe.find((t) => t.jahr === b.jahr)?.verfallenHalbtage ?? 0;
        if (nachher - vorher !== b.halbtage)
          fehler.push(
            `seed ${seed} jahr ${b.jahr}: droht ${b.halbtage}, verfallen ${nachher - vorher}`,
          );
      }
    }
    expect(fehler.slice(0, 5)).toEqual([]);
  });

  it("with notices as verfallHinweis gives them, named == every-notice-names-all (S-402)", () => {
    const fehler: string[] = [];
    for (let seed = 1; seed <= 1500; seed++) {
      const e = zufall(seed);
      const tageListe = [...(e.hinweise ?? [])].filter((t) => t <= e.heute).sort();
      const benannt: BenannterHinweis[] = [];
      for (const tag of tageListe) {
        const h = verfallHinweis(
          { ...e, benannt: [...benannt], hinweise: benannt.map((b) => b.tag) },
          tag,
        );
        if (!h.ok) throw new Error(h.grund);
        benannt.push({ tag, posten: h.wert.map(({ jahr, halbtage }) => ({ jahr, halbtage })) });
      }
      const mit = rechne({ ...e, hinweise: tageListe, benannt });
      const { benannt: _, ...ohneBenannt } = e;
      const ohne = rechne({ ...ohneBenannt, hinweise: tageListe });
      const zahlen = (w: typeof mit) =>
        JSON.stringify(
          w.toepfe.map((t) => [t.jahr, t.genommenHalbtage, t.verfallenHalbtage, t.restHalbtage]),
        );
      if (zahlen(mit) !== zahlen(ohne))
        fehler.push(
          `seed ${seed} ${JSON.stringify({ e: { ...e, hinweise: tageListe, benannt }, mit: mit.toepfe, ohne: ohne.toepfe })}`,
        );
    }
    expect(fehler.slice(0, 5)).toEqual([]);
  });
});

describe("review r3: single cases", () => {
  const basis: UrlaubskontoEingaben = {
    jahre: [{ jahr: 2026, anspruchHalbtage: tage(20) }],
    genommen: [
      { tag: "2026-08-03", halbtage: tage(17) },
      { tag: "2026-11-02", halbtage: tage(1) },
    ],
    anpassungen: [{ jahr: 2026, halbtage: tage(1) }],
    hinweise: ["2026-10-01"],
    benannt: [{ tag: "2026-10-01", posten: [{ jahr: 2026, halbtage: tage(3) }] }],
    heute: "2026-12-01",
  };

  it("R-23 'genommen nach dem Hinweis' on 1.12.2026: the findings say what will expire and that a notice is due for the rest", () => {
    const vorher = rechne(basis);
    const nachher = rechne({ ...basis, heute: "2027-04-01" });
    expect(nachher.toepfe[0]).toMatchObject({ verfallenHalbtage: tage(2), restHalbtage: tage(1) });
    const droht = vorher.befunde.find((b) => b.art === "verfall_droht");
    expect.soft(droht?.halbtage).toBe(tage(2));
    expect
      .soft(vorher.befunde.some((b) => b.art === "hinweis_faellig" && b.halbtage === tage(1)))
      .toBe(true);
  });

  it("two notices for different years on the same day; a notice on the expiry day; leap year", () => {
    const w = rechne({
      jahre: [
        { jahr: 2027, anspruchHalbtage: tage(10) },
        { jahr: 2028, anspruchHalbtage: tage(10) },
      ],
      genommen: [],
      hinweise: ["2028-02-29", "2028-03-31"],
      benannt: [
        { tag: "2028-02-29", posten: [{ jahr: 2027, halbtage: tage(10) }] },
        { tag: "2028-03-31", posten: [{ jahr: 2028, halbtage: tage(10) }] },
      ],
      heute: "2029-04-01",
    });
    // 2027: late notice (after 31.12.2027) → expires end of 31.3.2029; 2028: in time → 31.3.2029
    expect(w.toepfe.map((t) => t.verfallenHalbtage)).toEqual([tage(10), tage(10)]);
    const amTag = rechne({
      jahre: [{ jahr: 2026, anspruchHalbtage: tage(5) }],
      genommen: [],
      hinweise: ["2027-03-31"],
      benannt: [{ tag: "2027-03-31", posten: [{ jahr: 2026, halbtage: tage(5) }] }],
      heute: "2027-04-01",
    });
    expect(amTag.toepfe[0]?.verfallenHalbtage).toBe(0);
    expect(amTag.toepfe[0]?.verfaelltAm).toBe("2028-03-31");
  });
});
