import { describe, expect, it } from "vitest";
import { gehen, kommen, tage } from "../arbeitstag/testhilfen.ts";
import type { PruefTag } from "../pruefung/typen.ts";
import type { Lohn, Lohnmonat, Zuschlag } from "./lohn.ts";
import { type MindestlohnOptionen, mindestlohn } from "./mindestlohn.ts";
import { arbeitIm, gehalt, monat, stundenlohn } from "./testhilfen.ts";

/*
 * docs/regeln.md, R-14 (cases taken literally): November 2026, minimum wage 13,90 € (Jahreswert
 * 2026), 43 h = 2580 minutes of work.
 */
const STUNDEN_43 = arbeitIm("2026-11-02", 43 * 60);

const pruefe = (monate: Lohnmonat[], optionen?: MindestlohnOptionen) => {
  const ergebnis = mindestlohn(monate, optionen);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

const november = (lohn: Lohn, zuschlaege: Zuschlag[] = []) =>
  monat("2026-11", lohn, STUNDEN_43, { zuschlaege });

const befundeIm = (lohn: Lohn, zuschlaege?: Zuschlag[], optionen?: MindestlohnOptionen) => {
  const ergebnis = pruefe([november(lohn, zuschlaege)], optionen);
  expect(ergebnis.nichtHinterlegt).toEqual([]);
  return ergebnis.befunde;
};

const unter = (lohnCent: number, fehlendCent: number) => ({
  regel: "R-14",
  norm: "§ 1 Abs. 1 MiLoG",
  schwere: "verstoss",
  art: "unter_mindestlohn",
  tage: STUNDEN_43.map((tag) => tag.tag),
  monat: "2026-11",
  minuten: 2580,
  lohnCent,
  mindestlohnCent: 59770,
  fehlendCent,
});

describe("R-14: Mindestlohn je Monat", () => {
  it("erlaubt: 603,00 € für 43 h (Minijob) – 14,02 €/h, no finding", () => {
    expect(befundeIm(gehalt(60300))).toEqual([]);
  });

  it("Grenze: 597,70 € für 43 h – genau 13,90 €/h, no finding", () => {
    expect(befundeIm(gehalt(59770))).toEqual([]);
  });

  it("Verstoß: 597,69 € für 43 h – Verstoß „unter dem Mindestlohn“", () => {
    expect(befundeIm(gehalt(59769))).toEqual([unter(59769, 1)]);
  });

  it("nicht hinterlegt: Monat in einem Jahr ohne Jahreswert – „nicht hinterlegt“", () => {
    const tage2028 = arbeitIm("2028-11-01", 43 * 60);
    const ergebnis = pruefe([monat("2028-11", gehalt(1), tage2028)]);
    expect(ergebnis.befunde).toEqual([]);
    expect(ergebnis.nichtHinterlegt).toEqual(tage2028.map((tag) => tag.tag));
  });

  it("Stundenlohn: 43 h zu 13,90 € je Stunde – no finding", () => {
    expect(befundeIm(stundenlohn(1390))).toEqual([]);
  });

  it("Stundenlohn darunter: 43 h zu 13,89 € – Verstoß, es fehlen 0,43 €", () => {
    expect(befundeIm(stundenlohn(1389))).toEqual([unter(59727, 43)]);
  });

  it("Sonntagszuschlag: 590,00 € und 7,70 € Sonntagszuschlag für 43 h – no finding", () => {
    expect(befundeIm(gehalt(59000), [{ art: "sonntag", cent: 770 }])).toEqual([]);
    expect(befundeIm(gehalt(59000), [{ art: "feiertag", cent: 770 }])).toEqual([]);
  });

  it("Nachtzuschlag: 590,00 € und 7,70 € Nachtzuschlag für 43 h – Verstoß, es fehlen 7,70 €", () => {
    expect(befundeIm(gehalt(59000), [{ art: "nacht", cent: 770 }])).toEqual([unter(59000, 770)]);
  });

  it("Jahreswechsel: Nachtschicht 31.12. 22:00 bis 1.1. 6:00 zu 13,90 € – es fehlen 4,20 €", () => {
    const nacht = tage([kommen("2026-12-31T22:00+01:00"), gehen("2027-01-01T06:00+01:00")]);
    const ergebnis = pruefe([monat("2026-12", stundenlohn(1390), nacht)]);
    expect(ergebnis).toEqual({
      befunde: [
        {
          regel: "R-14",
          norm: "§ 1 Abs. 1 MiLoG",
          schwere: "verstoss",
          art: "unter_mindestlohn",
          tage: ["2026-12-31"],
          monat: "2026-12",
          minuten: 480,
          lohnCent: 11120,
          mindestlohnCent: 2780 + 8760,
          fehlendCent: 420,
        },
      ],
      nichtHinterlegt: [],
    });
  });

  it("Ausnahme: Auszubildender, 500,00 € für 43 h – no finding", () => {
    expect(befundeIm(gehalt(50000), [], { ausnahmen: [{ grund: "auszubildend" }] })).toEqual([]);
  });

  it("Ausnahme endet im Monat: langzeitarbeitslos bis 15.11. – Verstoß, der Monat ganz geprüft", () => {
    const ausnahmen = [{ grund: "langzeitarbeitslos" as const, bis: "2026-11-15" }];
    expect(befundeIm(gehalt(50000), [], { ausnahmen })).toEqual([unter(50000, 9770)]);
    const ganz = [{ grund: "langzeitarbeitslos" as const, bis: "2026-11-30" }];
    expect(befundeIm(gehalt(50000), [], { ausnahmen: ganz })).toEqual([]);
  });

  it("Ausnahme ohne Ende: langzeitarbeitslos ohne Ende der Ausnahme – Verstoß", () => {
    const ausnahmen = [{ grund: "langzeitarbeitslos" as const }];
    expect(befundeIm(gehalt(50000), [], { ausnahmen })).toEqual([unter(50000, 9770)]);
  });
});

describe("R-14: the month and its input", () => {
  it("Ausnahme Jugendliche ohne Ende: Jugendlicher ohne Berufsabschluss ohne Ende der Ausnahme, 500,00 € für 43 h – Verstoß (§ 22 Abs. 2 MiLoG gilt bis 18)", () => {
    const ausnahmen = [{ grund: "jugendlich_ohne_abschluss" as const }];
    expect(befundeIm(gehalt(50000), [], { ausnahmen })).toEqual([unter(50000, 9770)]);
    const bis18 = [{ grund: "jugendlich_ohne_abschluss" as const, bis: "2026-12-01" }];
    expect(befundeIm(gehalt(50000), [], { ausnahmen: bis18 })).toEqual([]);
  });

  it("an exception Soll does not know, or with an end that is no day, excepts nothing", () => {
    const unbekannt = [{ grund: "praktikum" as never }];
    expect(befundeIm(gehalt(50000), [], { ausnahmen: unbekannt })).toHaveLength(1);
    const kaputt = [{ grund: "auszubildend" as const, bis: "2026-11-31" }];
    expect(befundeIm(gehalt(50000), [], { ausnahmen: kaputt })).toHaveLength(1);
  });

  it("an open shift does not count (R-01 reports it); a month without work owes nothing", () => {
    const offen: PruefTag[] = tage([kommen("2026-11-02T08:00+01:00")]);
    expect(pruefe([monat("2026-11", stundenlohn(0), offen)]).befunde).toEqual([]);
    expect(pruefe([monat("2026-11", gehalt(0))]).befunde).toEqual([]);
  });

  it("a day before the first rule version is not judged", () => {
    const alt = arbeitIm("2025-11-03", 60);
    expect(pruefe([monat("2025-11", gehalt(0), alt)])).toEqual({
      befunde: [],
      nichtHinterlegt: ["2025-11-03"],
    });
  });

  it("refuses fractions of a cent, negative cents, a day of another month and a month twice", () => {
    const ungueltig = (monate: Lohnmonat[]) => expect(mindestlohn(monate).ok).toBe(false);
    ungueltig([november(gehalt(100.5))]);
    ungueltig([november(gehalt(-1))]);
    ungueltig([november(gehalt(100), [{ art: "sonntag", cent: 0.1 }])]);
    ungueltig([monat("2026-12", gehalt(100), STUNDEN_43)]);
    ungueltig([november(gehalt(100)), november(gehalt(100))]);
    ungueltig([monat("2026-13", gehalt(100))]);
  });
});
