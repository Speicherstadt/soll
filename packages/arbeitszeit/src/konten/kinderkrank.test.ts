import { describe, expect, it } from "vitest";
import { plusTage } from "../kalender/tag.ts";
import { type KindKrankTag, kinderkrankZaehlen } from "./kinderkrank.ts";

/** `anzahl` working days of Kind krank for one child from a Monday on (weekends skipped) */
const tageFuer = (kind: string, ab: string, anzahl: number): KindKrankTag[] => {
  const tage: KindKrankTag[] = [];
  for (let tag = ab; tage.length < anzahl; tag = plusTage(tag, 1)) {
    const wochentag = new Date(`${tag}T00:00:00Z`).getUTCDay();
    if (wochentag !== 0 && wochentag !== 6) tage.push({ tag, kind });
  }
  return tage;
};

const zaehlen = (jahr: number, tage: KindKrankTag[], alleinerziehend = false) => {
  const ergebnis = kinderkrankZaehlen(jahr, tage, alleinerziehend);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

/* docs/regeln.md, R-28 (cases taken literally): 2026, one child, not a single parent */
describe("R-28: Kinderkrankentage", () => {
  it("erlaubt: 10 days – no finding", () => {
    expect(zaehlen(2026, tageFuer("a", "2026-02-02", 10)).befunde).toEqual([]);
  });

  it("Grenze: 15 days – Hinweis „Anspruch erreicht“", () => {
    const tage = tageFuer("a", "2026-02-02", 15);
    expect(zaehlen(2026, tage).befunde).toEqual([
      {
        regel: "R-28",
        norm: "§ 45 Abs. 2a Satz 1 SGB V",
        schwere: "hinweis",
        art: "anspruch_erreicht",
        tage: [tage[14]?.tag],
        kind: "a",
      },
    ]);
  });

  it("Verstoß: 16 days – Hinweis „über dem Anspruch auf Krankengeld“", () => {
    const tage = tageFuer("a", "2026-02-02", 16);
    expect(zaehlen(2026, tage).befunde).toEqual([
      {
        regel: "R-28",
        norm: "§ 45 Abs. 2a Satz 1 SGB V",
        schwere: "hinweis",
        art: "ueber_anspruch",
        tage: [tage[15]?.tag],
        kind: "a",
      },
    ]);
  });

  it("2027: 11 days without a new rule – Hinweis (10 days under Abs. 2)", () => {
    const befunde = zaehlen(2027, tageFuer("a", "2027-02-01", 11)).befunde;
    expect(befunde).toMatchObject([{ art: "ueber_anspruch", norm: "§ 45 Abs. 2 Satz 1 SGB V" }]);
  });
});

describe("Kinderkrankentage", () => {
  it("counts each child on its own and all children up to the maximum", () => {
    // 2026: 15 per child, at most 35; three children with 12 days each pass 35 on the last child
    const tage = [
      ...tageFuer("a", "2026-01-05", 12),
      ...tageFuer("b", "2026-03-02", 12),
      ...tageFuer("c", "2026-05-04", 12),
    ];
    const wert = zaehlen(2026, tage);
    expect(wert.gesamt).toBe(36);
    expect(wert.befunde.map((b) => [b.kind, b.art, b.tage.length])).toEqual([
      ["c", "ueber_anspruch", 1],
    ]);
  });

  it("gives a single parent twice the days", () => {
    const wert = zaehlen(2026, tageFuer("a", "2026-02-02", 16), true);
    expect(wert.anspruchJeKind).toBe(30);
    expect(wert.befunde).toEqual([]);
  });

  it("counts a day twice entered (two halves) once", () => {
    const tage = tageFuer("a", "2026-02-02", 15);
    expect(zaehlen(2026, [...tage, ...tage.slice(0, 1)]).jeKind).toEqual({ a: 15 });
  });

  it("is nicht hinterlegt in a year without the value, and refuses a day of another year", () => {
    expect(kinderkrankZaehlen(2028, [])).toEqual({ ok: false, grund: "nicht_hinterlegt" });
    expect(kinderkrankZaehlen(2026, [{ tag: "2027-01-04", kind: "a" }])).toEqual({
      ok: false,
      grund: "ungueltig",
    });
  });
});
