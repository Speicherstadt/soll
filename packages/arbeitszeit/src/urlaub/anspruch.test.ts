import { describe, expect, it } from "vitest";
import { modell } from "../soll/testhilfen.ts";
import { urlaubsanspruch } from "./anspruch.ts";
import { anspruch, BASIS, MO_DO_8, mitUrlaub, tage } from "./testhilfen.ts";

/* docs/regeln.md, R-23 (cases taken literally), in 2026 */
describe("R-23: Mindesturlaub und Teilurlaub", () => {
  it("erlaubt: 5-day week, 25 days – no finding", () => {
    const wert = anspruch({ modelle: mitUrlaub(25) });
    expect(wert.befunde).toEqual([]);
    expect(wert.gesamtHalbtage).toBe(tage(25));
  });

  it("Grenze: 5-day week, 20 days – no finding (24 × 5 ÷ 6 = 20)", () => {
    expect(anspruch({ modelle: mitUrlaub(20) }).befunde).toEqual([]);
  });

  it("Verstoß: 5-day week, 19,5 days – Hinweis „unter dem gesetzlichen Mindesturlaub“", () => {
    const wert = anspruch({ modelle: mitUrlaub(19.5) });
    expect(wert.befunde).toEqual([
      {
        regel: "R-23",
        norm: "§ 3 Abs. 1 BUrlG",
        schwere: "hinweis",
        art: "unter_mindesturlaub",
        tage: ["2026-01-01"],
        urlaubHalbtage: 39,
        mindestHalbtage: 40,
      },
    ]);
    // the minimum applies all the same (§ 13 Abs. 1 Satz 1 BUrlG)
    expect(wert.gesamtHalbtage).toBe(tage(20));
  });

  it("Teilurlaub: Eintritt 1.8., 20 days, 5 full months – 8,33 → 8,5 days", () => {
    const wert = anspruch({
      modelle: [modell("2026-08-01")],
      beschaeftigung: { eintritt: "2026-08-01" },
    });
    expect(wert).toMatchObject({ art: "teil_a", zwoelftel: 5, gesamtHalbtage: tage(8.5) });
  });

  it("Rundung: Austritt 30.4. after the Wartezeit, 20 days, 4 full months: 6,67 – 7 days", () => {
    const wert = anspruch({ beschaeftigung: { eintritt: "2020-01-01", austritt: "2026-04-30" } });
    expect(wert).toMatchObject({ art: "teil_c", zwoelftel: 4, gesamtHalbtage: tage(7) });
  });

  it("Wartezeit: Eintritt 1.6., 20 days, 7 full months (Wartezeit fulfilled on 30.11.) – 20 days", () => {
    const wert = anspruch({
      modelle: [modell("2026-06-01")],
      beschaeftigung: { eintritt: "2026-06-01" },
    });
    expect(wert).toMatchObject({ art: "voll", gesamtHalbtage: tage(20) });
  });

  it("4-Tage-Woche: Mo–Do without leave of its own, whole year – 16 days", () => {
    expect(anspruch({ modelle: [modell("2020-01-01", MO_DO_8)] }).gesamtHalbtage).toBe(tage(16));
  });

  it("Wartezeit am 31.12.: Eintritt 1.7., 20 days – 20 days, no Teilurlaub", () => {
    const wert = anspruch({
      modelle: [modell("2026-07-01")],
      beschaeftigung: { eintritt: "2026-07-01" },
    });
    expect(wert).toMatchObject({ art: "voll", gesamtHalbtage: tage(20) });
  });

  it("Eintritt 2.7.: 20 days, 5 full months (2.7. – 1.12.) – 8,33 → 8,5 days", () => {
    const wert = anspruch({
      modelle: [modell("2026-07-02")],
      beschaeftigung: { eintritt: "2026-07-02" },
    });
    expect(wert).toMatchObject({ art: "teil_a", zwoelftel: 5, gesamtHalbtage: tage(8.5) });
  });

  it("Monatsmitte: Eintritt 15.8., 20 days, 4 full months (15.8. – 14.12.) – 6,67 → 7 days", () => {
    const wert = anspruch({
      modelle: [modell("2026-08-15")],
      beschaeftigung: { eintritt: "2026-08-15" },
    });
    expect(wert).toMatchObject({ zwoelftel: 4, gesamtHalbtage: tage(7) });
  });

  it("vor der Wartezeit: Eintritt 1.2., Austritt 30.6., 20 days, 5 full months – 8,5 days", () => {
    const wert = anspruch({
      modelle: [modell("2026-02-01")],
      beschaeftigung: { eintritt: "2026-02-01", austritt: "2026-06-30" },
    });
    expect(wert).toMatchObject({ art: "teil_b", zwoelftel: 5, gesamtHalbtage: tage(8.5) });
  });

  it("zweites Halbjahr: Austritt 31.7. after the Wartezeit, 20 days – 20 days", () => {
    const wert = anspruch({ beschaeftigung: { eintritt: "2020-01-01", austritt: "2026-07-31" } });
    expect(wert).toMatchObject({ art: "voll", gesamtHalbtage: tage(20) });
  });

  it("Modellwechsel: Mo–Fr to 30.6.2026, Mo–Mi from 1.7.2026 – 15,97 → 16 days", () => {
    const wert = anspruch({
      modelle: [modell("2020-01-01"), modell("2026-07-01", [480, 480, 480, 0, 0, 0, 0])],
    });
    expect(wert.gesamtHalbtage).toBe(tage(16));
  });
});

describe("Urlaubsanspruch: Grenzen der Beschäftigung", () => {
  it("counts an Eintritt on the 1st of January and an Austritt on the 31st of December as the whole year", () => {
    const wert = anspruch({
      modelle: [modell("2026-01-01")],
      beschaeftigung: { eintritt: "2026-01-01", austritt: "2026-12-31" },
    });
    expect(wert).toMatchObject({ art: "voll", gesamtHalbtage: tage(20) });
  });

  it("gives six twelfths for an Austritt on 30.6. after the Wartezeit", () => {
    const wert = anspruch({ beschaeftigung: { eintritt: "2020-01-01", austritt: "2026-06-30" } });
    expect(wert).toMatchObject({ art: "teil_c", zwoelftel: 6, gesamtHalbtage: tage(10) });
  });

  it("gives no full month for an Austritt on 30.1. (1.1. – 30.1. is no full month)", () => {
    const wert = anspruch({ beschaeftigung: { eintritt: "2020-01-01", austritt: "2026-01-30" } });
    expect(wert).toMatchObject({ art: "teil_c", zwoelftel: 0, gesamtHalbtage: 0 });
  });

  it("counts an Eintritt on the last day of a month in a leap year by §§ 187, 188 BGB", () => {
    // 31.8.2028: 30.9., 30.10., 30.11., 30.12. – four full months, the fifth would end on 30.1.
    const wert = anspruch({
      jahr: 2028,
      modelle: [modell("2028-08-31")],
      beschaeftigung: { eintritt: "2028-08-31" },
    });
    expect(wert).toMatchObject({ art: "teil_a", zwoelftel: 4, gesamtHalbtage: tage(7) });
  });

  it("weights a model change by the days of a leap year", () => {
    // 2028: 1.1. – 30.6. are 182 days, 1.7. – 31.12. 184; 20 × 182 ÷ 366 + 12 × 184 ÷ 366 = 15,98
    const wert = anspruch({
      jahr: 2028,
      modelle: [modell("2020-01-01"), modell("2028-07-01", [480, 480, 480, 0, 0, 0, 0])],
    });
    expect(wert.gesamtHalbtage).toBe(tage(16));
  });

  it("keeps a half day of the full leave: § 5 Abs. 2 BUrlG rounds only the twelfths of § 5 Abs. 1", () => {
    // a model with 25,5 days, the whole year: nothing to round (BAG, 26.01.1989, 8 AZR 730/87)
    expect(anspruch({ modelle: mitUrlaub(25.5) })).toMatchObject({
      art: "voll",
      gesamtHalbtage: tage(25.5),
    });
    // Teilurlaub: 6 × 25 ÷ 12 = 12,5 is a fraction of § 5 Abs. 1 and rounds up to 13
    const teil = anspruch({
      modelle: mitUrlaub(25),
      beschaeftigung: { eintritt: "2020-01-01", austritt: "2026-06-30" },
    });
    expect(teil).toMatchObject({ art: "teil_c", zwoelftel: 6, gesamtHalbtage: tage(13) });
  });

  it("has no leave in a year without employment, and none is owed before the Eintritt", () => {
    expect(anspruch({ beschaeftigung: { eintritt: "2027-01-01" } })).toMatchObject({
      art: "keiner",
      gesamtHalbtage: 0,
    });
  });

  it("is nicht hinterlegt for a day of the employment without a model, and for a model without working days", () => {
    expect(urlaubsanspruch({ ...BASIS, modelle: [modell("2026-03-01")] })).toEqual({
      ok: false,
      grund: "nicht_hinterlegt",
    });
    const nachPlan = [modell("2020-01-01", [0, 0, 0, 0, 0, 0, 0])];
    expect(urlaubsanspruch({ ...BASIS, modelle: nachPlan }).ok).toBe(false);
    const mitTagen = [modell("2020-01-01", [0, 0, 0, 0, 0, 0, 0], { arbeitstageJeWoche: 2 })];
    expect(anspruch({ modelle: mitTagen }).gesamtHalbtage).toBe(tage(8));
  });

  it("refuses invalid entries", () => {
    expect(urlaubsanspruch({ ...BASIS, jahr: 2026.5 }).ok).toBe(false);
    expect(urlaubsanspruch({ ...BASIS, zusatzurlaubHalbtage: -1 }).ok).toBe(false);
    expect(
      urlaubsanspruch({ ...BASIS, elternzeit: [{ von: "2026-05-01", bis: "2026-04-01" }] }).ok,
    ).toBe(false);
  });
});
