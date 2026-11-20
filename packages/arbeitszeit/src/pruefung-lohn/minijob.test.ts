import { describe, expect, it } from "vitest";
import { type Monat, plusMonate } from "../kalender/monat.ts";
import type { Lohnmonat } from "./lohn.ts";
import { minijobGrenze } from "./minijob.ts";
import { arbeitIm, gehalt, monat, stundenlohn } from "./testhilfen.ts";

/*
 * docs/regeln.md, R-32 (cases taken literally): November 2026, limit 603 € (Jahreswert 2026), a
 * mini-job since 1.1.2026 at 400,00 € in each month before unless the case says otherwise.
 */
const monateVon = (von: Monat, bis: Monat): Monat[] => {
  const monate: Monat[] = [];
  for (let m = von; m <= bis; m = plusMonate(m, 1)) monate.push(m);
  return monate;
};

/** Monthly wages in cents from `von` to `bis`, 400,00 € where `abweichend` names no other */
const verlauf = (von: Monat, bis: Monat, abweichend: Record<Monat, number>): Lohnmonat[] =>
  monateVon(von, bis).map((m) => monat(m, gehalt(abweichend[m] ?? 40000)));

const pruefe = (monate: Lohnmonat[]) => {
  const ergebnis = minijobGrenze(monate);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

/** The findings of November 2026 with the months before at 400,00 € */
const imNovember = (cent: number, abweichend: Record<Monat, number> = {}) => {
  const ergebnis = pruefe(verlauf("2026-01", "2026-11", { ...abweichend, "2026-11": cent }));
  expect(ergebnis.nichtHinterlegt).toEqual([]);
  return ergebnis.befunde;
};

const befund = (
  art: "gelegentlich" | "schwankend" | "grenze_ueberschritten",
  lohnCent: number,
  monateUeber: number,
  monatText = "2026-11",
  grenzeCent = 60300,
) => ({
  regel: "R-32",
  norm: art === "gelegentlich" ? "§ 8 Abs. 1b SGB IV" : "§ 8 Abs. 1 Nr. 1 SGB IV",
  schwere: art === "grenze_ueberschritten" ? "verstoss" : "hinweis",
  art,
  tage: [],
  monat: monatText,
  lohnCent,
  grenzeCent,
  ueberCent: lohnCent - grenzeCent,
  monateUeber,
});

describe("R-32: Minijob-Grenze", () => {
  it("erlaubt: 580,00 € – no finding", () => {
    expect(imNovember(58000)).toEqual([]);
  });

  it("Grenze: 603,00 € – no finding („nicht übersteigt“)", () => {
    expect(imNovember(60300)).toEqual([]);
  });

  it("Verstoß: seit 1.9.2026 je 650,00 € – Verstoß im November, Hinweise im September und Oktober", () => {
    const ergebnis = pruefe(
      verlauf("2026-09", "2026-11", { "2026-09": 65000, "2026-10": 65000, "2026-11": 65000 }),
    );
    expect(ergebnis).toEqual({
      befunde: [
        befund("gelegentlich", 65000, 1, "2026-09"),
        befund("gelegentlich", 65000, 2, "2026-10"),
        befund("grenze_ueberschritten", 65000, 3),
      ],
      nichtHinterlegt: [],
    });
  });

  it("gelegentlich: 603,01 € – Hinweis „gelegentlich überschritten“", () => {
    expect(imNovember(60301)).toEqual([befund("gelegentlich", 60301, 1)]);
  });

  it("gelegentlich, Grenze: 1.206,00 € – Hinweis „gelegentlich überschritten“", () => {
    expect(imNovember(120600)).toEqual([befund("gelegentlich", 120600, 1)]);
  });

  it("mehr als das Doppelte: 1.206,01 € – Hinweis „schwankend“", () => {
    expect(imNovember(120601)).toEqual([befund("schwankend", 120601, 1)]);
  });

  it("dritter Monat: je 700,00 € im Februar, Juli und November – Hinweis „schwankend“ im November", () => {
    const befunde = imNovember(70000, { "2026-02": 70000, "2026-07": 70000 });
    expect(befunde).toEqual([
      befund("gelegentlich", 70000, 1, "2026-02"),
      befund("gelegentlich", 70000, 2, "2026-07"),
      befund("schwankend", 70000, 3),
    ]);
  });

  it("Zeitjahr: 700,00 € im November 2025, Februar und November 2026 – gelegentlich im November 2026", () => {
    const monate = verlauf("2025-11", "2026-11", {
      "2025-11": 70000,
      "2026-02": 70000,
      "2026-11": 70000,
    });
    const ergebnis = pruefe(monate);
    expect(ergebnis.befunde.at(-1)).toEqual(befund("gelegentlich", 70000, 2));
    expect(ergebnis.nichtHinterlegt).toEqual(["2025-11-01", "2025-12-01"]);
  });

  it("Stundenlohn: 43 h zu 14,03 € je Stunde (603,29 €) – Hinweis „gelegentlich überschritten“", () => {
    const stunden = arbeitIm("2026-11-02", 43 * 60);
    const monate = [
      ...verlauf("2026-01", "2026-10", {}),
      monat("2026-11", stundenlohn(1403), stunden),
    ];
    expect(pruefe(monate).befunde).toEqual([
      { ...befund("gelegentlich", 60329, 1), tage: stunden.map((tag) => tag.tag) },
    ]);
  });

  it("steuerfreier Zuschlag: 590,00 € und 20,00 € steuerfreier Sonntagszuschlag – no finding", () => {
    const frei = monat("2026-11", gehalt(59000), [], {
      zuschlaege: [{ art: "sonntag", cent: 2000, steuerfrei: true }],
    });
    expect(pruefe([frei]).befunde).toEqual([]);
    const versteuert = { ...frei, zuschlaege: [{ art: "sonntag" as const, cent: 2000 }] };
    expect(pruefe([versteuert]).befunde).toEqual([befund("gelegentlich", 61000, 1)]);
  });

  it("Jahreswechsel: je 620,00 € im Dezember 2026 und Januar 2027 – Hinweis nur im Dezember", () => {
    const monate = verlauf("2026-01", "2027-01", { "2026-12": 62000, "2027-01": 62000 });
    expect(pruefe(monate)).toEqual({
      befunde: [befund("gelegentlich", 62000, 1, "2026-12")],
      nichtHinterlegt: [],
    });
  });

  it("nicht hinterlegt: Monat in einem Jahr ohne Jahreswert – „nicht hinterlegt“", () => {
    expect(pruefe([monat("2028-03", gehalt(40000))])).toEqual({
      befunde: [],
      nichtHinterlegt: ["2028-03-01"],
    });
  });
});

describe("R-32: the months it reads", () => {
  it("judges only mini-job months, and only they count in the Zeitjahr", () => {
    const monate = verlauf("2026-01", "2026-11", {
      "2026-02": 70000,
      "2026-07": 70000,
      "2026-11": 70000,
    });
    const vollzeit = monate.map((m) => (m.monat === "2026-02" ? { ...m, minijob: false } : m));
    expect(pruefe(vollzeit).befunde).toEqual([
      befund("gelegentlich", 70000, 1, "2026-07"),
      befund("gelegentlich", 70000, 2),
    ]);
  });

  it("a month before the first rule version is „nicht hinterlegt“ but counts in a later Zeitjahr", () => {
    const monate = verlauf("2025-11", "2026-03", {
      "2025-11": 70000,
      "2025-12": 70000,
      "2026-03": 70000,
    });
    expect(pruefe(monate)).toEqual({
      befunde: [befund("schwankend", 70000, 3, "2026-03")],
      nichtHinterlegt: ["2025-11-01", "2025-12-01"],
    });
  });

  it("refuses fractions of a cent", () => {
    expect(minijobGrenze([monat("2026-11", gehalt(0.5))]).ok).toBe(false);
  });
});
