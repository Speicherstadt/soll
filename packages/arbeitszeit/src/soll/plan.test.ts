import { describe, expect, it } from "vitest";
import { schicht } from "../dienstplan/testhilfen.ts";
import type { PlanSchicht } from "../dienstplan/typen.ts";
import type { Monat } from "../kalender/monat.ts";
import { tageImMonat } from "../kalender/monat.ts";
import { type MonatsEingaben, monatsstand } from "./monat.ts";
import { planMinutenJeTag, planSoll, type Sollquelle, sollquelleAm } from "./plan.ts";
import { tagesSoll } from "./tagessoll.ts";
import { abwesend, gearbeitet, hm, SANDRA, werktageMoFr } from "./testhilfen.ts";

/*
 * docs/regeln.md, R-33 „Soll aus dem Plan“ (S-505): from the day the business chose, the Soll of a
 * day is what the published plan holds for the person, in whole minutes, on the day a shift begins.
 */
const AB_NOVEMBER: Sollquelle[] = [{ ab: "2026-11-01", quelle: "plan" }];

const stand = (monat: Monat, schichten: PlanSchicht[], eingaben: Partial<MonatsEingaben> = {}) => {
  const plan = planSoll(tageImMonat(monat), AB_NOVEMBER, schichten);
  const ergebnis = monatsstand(monat, { ...SANDRA, plan, ...eingaben });
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

const frueh = (tag: string) => schicht(tag, "06:00", "14:30", { pauseMinuten: 30 });

describe("the planned minutes of a day (S-505)", () => {
  it("counts work without the break on the day a shift begins, a night shift included", () => {
    const minuten = planMinutenJeTag([
      frueh("2026-11-23"),
      schicht("2026-11-23", "22:00", "06:00", { pauseMinuten: 30 }),
    ]);
    expect(minuten).toEqual(new Map([["2026-11-23", hm("8:00") + hm("7:30")]]));
  });

  it("Herbst: 22:00 – 6:00 in the night of 25.10.2026 has 9 hours", () => {
    expect(planMinutenJeTag([schicht("2026-10-24", "22:00", "06:00")]).get("2026-10-24")).toBe(
      hm("9:00"),
    );
  });

  it("Frühjahr: 22:00 – 6:00 in the night of 28.03.2027 has 7 hours", () => {
    expect(planMinutenJeTag([schicht("2027-03-27", "22:00", "06:00")]).get("2027-03-27")).toBe(
      hm("7:00"),
    );
  });

  it("a break longer than its shift owes nothing, never less", () => {
    const kurz = schicht("2026-11-23", "08:00", "08:30", { pauseMinuten: 45 });
    expect(planMinutenJeTag([kurz]).get("2026-11-23")).toBe(0);
  });
});

describe("the source of the Soll (S-505)", () => {
  const quellen: Sollquelle[] = [
    { ab: "2026-12-01", quelle: "modell" },
    { ab: "2026-11-16", quelle: "plan" },
  ];

  it("the latest entry on or before the day decides, the model without one", () => {
    expect(sollquelleAm(quellen, "2026-11-15")).toBe("modell");
    expect(sollquelleAm(quellen, "2026-11-16")).toBe("plan");
    expect(sollquelleAm(quellen, "2026-11-30")).toBe("plan");
    expect(sollquelleAm(quellen, "2026-12-01")).toBe("modell");
    expect(sollquelleAm([], "2026-11-30")).toBe("modell");
  });

  it("only the days of the plan come from it, with 0 where nothing is planned", () => {
    const plan = planSoll(["2026-11-15", "2026-11-16", "2026-11-17"], quellen, [
      frueh("2026-11-17"),
    ]);
    expect(plan).toEqual(
      new Map([
        ["2026-11-16", 0],
        ["2026-11-17", hm("8:00")],
      ]),
    );
  });
});

describe("R-33 with the Soll from the plan (S-505)", () => {
  it("erlaubt: November 2026, the plan holds 8:00 on 21 days, 7:30 worked – Saldo −10:30", () => {
    const tage = werktageMoFr("2026-11");
    const monat = stand("2026-11", tage.map(frueh), { arbeitstage: gearbeitet(tage, hm("7:30")) });
    expect([monat.sollMinuten, monat.istMinuten, monat.saldoMinuten]).toEqual([
      hm("168:00"),
      hm("157:30"),
      hm("−10:30"),
    ]);
    expect(monat.tage.every((tag) => tag.ausPlan === true)).toBe(true);
  });

  it("Grenze: a day without a planned shift owes nothing, even where the model has 8:00", () => {
    const tage = werktageMoFr("2026-11").slice(0, 20);
    const monat = stand("2026-11", tage.map(frueh), { arbeitstage: gearbeitet(tage, hm("8:00")) });
    expect([monat.sollMinuten, monat.saldoMinuten]).toEqual([hm("160:00"), 0]);
  });

  it("Verstoß: worked beyond the plan – the minutes above it go into the balance", () => {
    const tage = werktageMoFr("2026-11");
    const monat = stand("2026-11", tage.map(frueh), { arbeitstage: gearbeitet(tage, hm("9:00")) });
    expect(monat.saldoMinuten).toBe(hm("21:00"));
  });

  it("Feiertag: a shift planned on a holiday is owed, a holiday without one owes nothing", () => {
    const ergebnis = tagesSoll("2026-12-25", {
      ...SANDRA,
      plan: new Map([["2026-12-25", hm("6:00")]]),
    });
    expect(ergebnis).toMatchObject({
      ok: true,
      wert: { sollMinuten: hm("6:00"), feiertag: null, ausfallMinuten: 0, ausPlan: true },
    });
    const frei = tagesSoll("2026-12-24", { ...SANDRA, plan: new Map([["2026-12-24", 0]]) });
    expect(frei).toMatchObject({ ok: true, wert: { sollMinuten: 0, ausfallMinuten: 0 } });
  });

  it("Urlaub: an absence is credited what the plan held (Ausfallprinzip, § 4 Abs. 1 EntgFG)", () => {
    const tage = werktageMoFr("2026-11");
    const monat = stand(
      "2026-11",
      tage.map((tag) => schicht(tag, "10:00", "16:00")),
      { abwesenheiten: abwesend("krank", ["2026-11-02"]) },
    );
    const montag = monat.tage.find((tag) => tag.tag === "2026-11-02");
    expect(montag?.gutschriftMinuten).toBe(hm("6:00"));
  });

  it("a day of the plan needs no model: the plan is its Soll", () => {
    const ohneModell = tagesSoll("2026-11-23", {
      ...SANDRA,
      modelle: [],
      plan: new Map([["2026-11-23", hm("4:00")]]),
    });
    expect(ohneModell).toMatchObject({ ok: true, wert: { sollMinuten: hm("4:00") } });
  });

  it("refuses planned minutes that are no whole number", () => {
    const plan = new Map([["2026-11-23", 7.5]]);
    expect(monatsstand("2026-11", { ...SANDRA, plan })).toEqual({ ok: false, grund: "ungueltig" });
  });

  it("outside the employment the plan owes nothing", () => {
    const vorher = tagesSoll("2026-11-23", {
      ...SANDRA,
      beschaeftigung: { eintritt: "2026-11-24" },
      plan: new Map([["2026-11-23", hm("4:00")]]),
    });
    expect(vorher).toMatchObject({ ok: true, wert: { sollMinuten: 0 } });
    expect(vorher.ok && vorher.wert.ausPlan).toBeFalsy();
  });

  it("Modellwechsel: until the 15th the model, from the 16th the plan", () => {
    const quellen: Sollquelle[] = [{ ab: "2026-11-16", quelle: "plan" }];
    const plan = planSoll(tageImMonat("2026-11"), quellen, [frueh("2026-11-16")]);
    const ergebnis = monatsstand("2026-11", { ...SANDRA, plan });
    // 10 working days of 8:00 by the model before the 16th, then one planned shift of 8:00
    expect(ergebnis.ok && ergebnis.wert.sollMinuten).toBe(hm("88:00"));
  });
});
