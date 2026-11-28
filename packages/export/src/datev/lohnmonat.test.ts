import { describe, expect, it } from "vitest";
import { type LohnmonatEingabe, lohnmonat } from "./lohnmonat.ts";
import {
  HAMBURG,
  minijobModell,
  monatsModell,
  monatsTage,
  type Schicht,
  stundenModell,
} from "./testdaten.ts";

const MO_FR = [480, 480, 480, 480, 480, 0, 0];
const SOMMER = "+02:00";
const WINTER = "+01:00";

/** Sandra, Weber Haustechnik: a month with the given shifts, hourly unless a model is given */
const sandra = (
  monat: string,
  schichten: Schicht[],
  mehr: Partial<LohnmonatEingabe> = {},
  offset = SOMMER,
): LohnmonatEingabe => ({
  nutzerId: "sandra",
  monat,
  tage: monatsTage(monat, MO_FR, schichten, offset),
  gegeneintraege: [],
  modelle: [stundenModell(2150)],
  standort: HAMBURG,
  ...mehr,
});

const posten = (eingabe: LohnmonatEingabe) => {
  const ergebnis = lohnmonat(eingabe);
  if (!ergebnis.ok) throw new Error(JSON.stringify(ergebnis.probleme));
  return ergebnis.wert.posten;
};

const probleme = (eingabe: LohnmonatEingabe) => {
  const ergebnis = lohnmonat(eingabe);
  if (ergebnis.ok) throw new Error("expected problems");
  return ergebnis.probleme;
};

const acht = (tag: string): Schicht => ({
  tag,
  von: "08:00",
  bis: "16:30",
  pause: ["12:00", "12:30"],
});

describe("lohnmonat: worked hours", () => {
  it("books an hourly wage's worked minutes to `stunden`, a mini-job's to `minijob`", () => {
    expect(posten(sandra("2026-06", [acht("2026-06-01")]))).toEqual([
      { art: "stunden", minuten: 480 },
    ]);
    expect(
      posten(sandra("2026-06", [acht("2026-06-01")], { modelle: [minijobModell(1400)] })),
    ).toEqual([{ art: "minijob", minuten: 480 }]);
  });

  it("books no hours for a monthly wage: it is master data in payroll", () => {
    expect(
      posten(sandra("2026-06", [acht("2026-06-01")], { modelle: [monatsModell(320_000)] })),
    ).toEqual([]);
  });

  it("books each day by the model in force on it (hourly until 15.6., monthly from 16.6.)", () => {
    const modelle = [stundenModell(2150), monatsModell(320_000, { ab: "2026-06-16" })];
    expect(
      posten(sandra("2026-06", [acht("2026-06-15"), acht("2026-06-16")], { modelle })),
    ).toEqual([{ art: "stunden", minuten: 480 }]);
  });

  it("counts a night shift over the month's end to the month it began in", () => {
    const nacht = { tag: "2026-10-31", von: "20:00", bis: "02:00" };
    expect(posten(sandra("2026-10", [nacht], {}, WINTER))).toEqual([
      { art: "stunden", minuten: 360 },
    ]);
  });

  it("counts the real minutes of the night the clocks go back (25.10.2026: 9 h, not 8)", () => {
    const tage = monatsTage("2026-10", MO_FR, [], WINTER).map((tag) =>
      tag.tag === "2026-10-24"
        ? {
            ...tag,
            stempel: [
              ["kommen", Date.parse("2026-10-24T22:00:00+02:00")],
              ["gehen", Date.parse("2026-10-25T06:00:00+01:00")],
            ] as const,
          }
        : tag,
    );
    expect(posten(sandra("2026-10", [], { tage }))).toEqual([{ art: "stunden", minuten: 540 }]);
  });

  it("adds the counter-entries booked in the month, by the model of the day they correct", () => {
    const gegeneintraege = [
      { tag: "2026-05-29", minuten: 45 },
      { tag: "2026-05-28", minuten: -15 },
    ];
    expect(posten(sandra("2026-06", [acht("2026-06-01")], { gegeneintraege }))).toEqual([
      { art: "stunden", minuten: 510 },
    ]);
  });

  it("refuses a month whose hours would go below zero", () => {
    const gegeneintraege = [{ tag: "2026-05-29", minuten: -600 }];
    expect(probleme(sandra("2026-06", [acht("2026-06-01")], { gegeneintraege }))).toEqual([
      { art: "negativ", nutzerId: "sandra", tage: [] },
    ]);
  });

  it("names a worked day without a model instead of guessing one", () => {
    const modelle = [stundenModell(2150, { ab: "2026-06-10" })];
    expect(
      probleme(sandra("2026-06", [acht("2026-06-01"), acht("2026-06-10")], { modelle })),
    ).toEqual([{ art: "modell", nutzerId: "sandra", tage: ["2026-06-01"] }]);
  });
});

describe("lohnmonat: holidays of an hourly wage (§ 2 Abs. 1 EntgFG)", () => {
  it("books the model's minutes of a holiday on a working day (Thu 14.5.2026 Himmelfahrt)", () => {
    const mai = posten(sandra("2026-05", []));
    // Fri 1.5., Thu 14.5., Mon 25.5.
    expect(mai).toEqual([{ art: "feiertag", minuten: 3 * 480 }]);
  });

  it("books only what the holiday took: worked 6 h on Whit Monday leaves 2 h", () => {
    const pfingsten = { tag: "2026-05-25", von: "08:00", bis: "14:00" };
    expect(posten(sandra("2026-05", [pfingsten]))).toEqual([
      { art: "stunden", minuten: 360 },
      { art: "feiertag", minuten: 2 * 480 + 120 },
    ]);
  });

  it("books nothing for a holiday on a day without model minutes, or for a monthly wage", () => {
    // Reformationstag and Tag der Deutschen Einheit fall on Saturdays in 2026
    expect(posten(sandra("2026-10", [], {}, WINTER))).toEqual([]);
    expect(posten(sandra("2026-05", [], { modelle: [monatsModell(320_000)] }))).toEqual([]);
  });

  it("names the days when the place's holidays are not known", () => {
    const ergebnis = probleme(sandra("2026-06", [], { standort: null }));
    expect(ergebnis).toHaveLength(1);
    expect(ergebnis[0]).toMatchObject({ art: "feiertage", nutzerId: "sandra" });
    expect(ergebnis[0]?.tage).toHaveLength(22);
  });

  it("skips model-based Feiertagsstunden on days whose Soll comes from the shift plan", () => {
    const basis = sandra("2026-10", [{ tag: "2026-10-03", von: "10:00", bis: "16:00" }]);
    const eingabe = {
      ...basis,
      tage: basis.tage.map((tag) =>
        tag.tag === "2026-10-03" ? { ...tag, modellMinuten: 480, planMinuten: 360 } : tag,
      ),
    };
    expect(posten(eingabe)).toEqual([{ art: "stunden", minuten: 360 }]);
  });
});

describe("lohnmonat: surcharges (§ 3b EStG, S-207)", () => {
  const sonntag = { tag: "2026-06-07", von: "10:00", bis: "14:00" };

  it("books paid surcharges in cents, the tax-free part apart from the taxable rest", () => {
    const modelle = [stundenModell(2000, { zuschlagssaetze: { sonntag: 6000 } })];
    // 4 h × 20,00 € × 60 % = 48,00 € paid, 50 % = 40,00 € tax-free, 8,00 € taxable
    expect(posten(sandra("2026-06", [sonntag], { modelle }))).toEqual([
      { art: "stunden", minuten: 240 },
      { art: "sonntag_steuerfrei", cent: 4000 },
      { art: "sonntag_steuerpflichtig", cent: 800 },
    ]);
  });

  it("pays no surcharge the model does not set", () => {
    expect(posten(sandra("2026-06", [sonntag]))).toEqual([{ art: "stunden", minuten: 240 }]);
  });

  it('names the days of a model with rates but no wage ("nicht hinterlegt")', () => {
    const modelle = [stundenModell(2000, { lohnCent: null, zuschlagssaetze: { sonntag: 5000 } })];
    expect(probleme(sandra("2026-06", [sonntag], { modelle }))).toEqual([
      { art: "lohn", nutzerId: "sandra", tage: ["2026-06-07"] },
    ]);
  });

  it("needs no wage for hours alone: payroll knows the hourly wage", () => {
    const modelle = [stundenModell(2000, { lohnCent: null })];
    expect(posten(sandra("2026-06", [sonntag], { modelle }))).toEqual([
      { art: "stunden", minuten: 240 },
    ]);
  });

  it("names days before the first rule version (1.1.2026) instead of computing them", () => {
    const modelle = [monatsModell(320_000, { ab: "2025-01-01", zuschlagssaetze: { nacht: 2500 } })];
    const nacht = { tag: "2025-12-05", von: "20:00", bis: "23:00" };
    expect(probleme(sandra("2025-12", [nacht], { modelle }, WINTER))).toEqual([
      { art: "zuschlaege", nutzerId: "sandra", tage: ["2025-12-05"] },
    ]);
  });
});

describe("lohnmonat: absences and overtime paid out (inputs of S-401 and S-208)", () => {
  it("books credited absences and paid-out overtime as hours of their own", () => {
    const eingabe = sandra("2026-06", [], {
      abwesenheiten: [
        { tag: "2026-06-01", art: "urlaub", minuten: 480 },
        { tag: "2026-06-02", art: "urlaub", minuten: 240 },
        { tag: "2026-06-03", art: "krank", minuten: 480 },
        { tag: "2026-06-04", art: "kind_krank", minuten: 480 },
        { tag: "2026-06-05", art: "sonderurlaub", minuten: 480 },
      ],
      ueberstundenMinuten: 600,
    });
    expect(posten(eingabe)).toEqual([
      { art: "urlaub", minuten: 720 },
      { art: "krank", minuten: 480 },
      { art: "kind_krank", minuten: 480 },
      { art: "sonderurlaub", minuten: 480 },
      { art: "ueberstunden", minuten: 600 },
    ]);
  });
});
