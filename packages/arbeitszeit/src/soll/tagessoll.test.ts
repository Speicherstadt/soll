import { describe, expect, it } from "vitest";
import { kindKrankTage, urlaubGenommen } from "./auszug.ts";
import { monatsstand } from "./monat.ts";
import { tagesSoll } from "./tagessoll.ts";
import { abwesend, modell, SANDRA, tageVonBis } from "./testhilfen.ts";
import type { Abwesenheit } from "./typen.ts";

const URLAUB_MO_FR = abwesend("urlaub", tageVonBis("2026-11-09", "2026-11-13"));

const imNovember = (abwesenheiten: Abwesenheit[]) => {
  const ergebnis = monatsstand("2026-11", { ...SANDRA, abwesenheiten });
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

const krankheitstage = (monat: ReturnType<typeof imNovember>) =>
  monat.tage.filter((tag) => tag.abwesenheiten.some((a) => a.art === "krank")).length;

/* docs/regeln.md, R-24 (cases taken literally): leave Mo 9.11. – Fr 13.11.2026 */
describe("R-24: Krank im Urlaub", () => {
  it("erlaubt: without sickness – 5 days of leave", () => {
    const monat = imNovember(URLAUB_MO_FR);
    expect(monat.urlaubHalbtage).toBe(10);
    expect(monat.befunde).toEqual([]);
  });

  it("Grenze: sick on Friday with a certificate – 4 days of leave, 1 day of sickness", () => {
    const monat = imNovember([
      ...URLAUB_MO_FR,
      ...abwesend("krank", ["2026-11-13"], { bescheinigung: true }),
    ]);
    expect(monat.urlaubHalbtage).toBe(8);
    expect(krankheitstage(monat)).toBe(1);
    expect(monat.befunde).toEqual([]);
  });

  it("Verstoß: sick Wed–Fri without a certificate – 5 days of leave, Hinweis „Bescheinigung fehlt“", () => {
    const monat = imNovember([
      ...URLAUB_MO_FR,
      ...abwesend("krank", tageVonBis("2026-11-11", "2026-11-13")),
    ]);
    expect(monat.urlaubHalbtage).toBe(10);
    expect(krankheitstage(monat)).toBe(0);
    expect(monat.befunde).toEqual([
      {
        regel: "R-24",
        norm: "§ 9 BUrlG",
        schwere: "hinweis",
        art: "bescheinigung_fehlt",
        tage: ["2026-11-11", "2026-11-12", "2026-11-13"],
      },
    ]);
  });

  it("half a day sick with a certificate on a whole day of leave leaves half a day of leave", () => {
    const tag = tagesSoll("2026-11-13", SANDRA, [
      ...abwesend("urlaub", ["2026-11-13"]),
      ...abwesend("krank", ["2026-11-13"], { halb: true, bescheinigung: true }),
    ]);
    if (!tag.ok) throw new Error(tag.grund);
    expect(tag.wert.urlaubHalbtage).toBe(1);
    expect(tag.wert.gutschriftMinuten).toBe(480);
  });

  it("half a day of leave and half a day sick do not collide", () => {
    const tag = tagesSoll("2026-11-13", SANDRA, [
      ...abwesend("urlaub", ["2026-11-13"], { halb: true }),
      ...abwesend("krank", ["2026-11-13"], { halb: true }),
    ]);
    if (!tag.ok) throw new Error(tag.grund);
    expect(tag.wert.urlaubHalbtage).toBe(1);
    expect(tag.wert.befunde).toEqual([]);
  });

  it("reports no missing certificate on a holiday, where no leave is charged", () => {
    const tag = tagesSoll("2026-12-25", SANDRA, [
      ...abwesend("urlaub", ["2026-12-25"]),
      ...abwesend("krank", ["2026-12-25"]),
    ]);
    if (!tag.ok) throw new Error(tag.grund);
    expect(tag.wert.urlaubHalbtage).toBe(0);
    expect(tag.wert.befunde).toEqual([]);
  });
});

describe("Soll eines Tages", () => {
  it("takes the model's minutes for the weekday, 0 on a holiday with the minutes as Ausfall", () => {
    const werktag = tagesSoll("2026-11-18", SANDRA);
    const feiertag = tagesSoll("2026-12-25", SANDRA);
    if (!werktag.ok || !feiertag.ok) throw new Error("erwartet");
    expect(werktag.wert).toMatchObject({ modellMinuten: 480, sollMinuten: 480, ausfallMinuten: 0 });
    expect(feiertag.wert).toMatchObject({
      modellMinuten: 480,
      sollMinuten: 0,
      ausfallMinuten: 480,
    });
    expect(feiertag.wert.feiertag?.name).toBe("1. Weihnachtstag");
  });

  it("credits Kind krank and Sonderurlaub with the Soll, a half day rounded up", () => {
    const krank = tagesSoll(
      "2026-11-18",
      SANDRA,
      abwesend("kind_krank", ["2026-11-18"], { kind: "a" }),
    );
    const sonder = tagesSoll(
      "2026-11-18",
      { ...SANDRA, modelle: [modell("2026-01-01", [481, 481, 481, 481, 481, 0, 0])] },
      abwesend("sonderurlaub", ["2026-11-18"], { halb: true }),
    );
    if (!krank.ok || !sonder.ok) throw new Error("erwartet");
    expect(krank.wert.gutschriftMinuten).toBe(480);
    expect(sonder.wert.gutschriftMinuten).toBe(241);
  });

  it("never credits two halves beyond the Soll", () => {
    const zweiHalbe = tagesSoll(
      "2026-11-18",
      { ...SANDRA, modelle: [modell("2026-01-01", [481, 481, 481, 481, 481, 0, 0])] },
      [
        ...abwesend("urlaub", ["2026-11-18"], { halb: true }),
        ...abwesend("sonderurlaub", ["2026-11-18"], { halb: true }),
      ],
    );
    if (!zweiHalbe.ok) throw new Error(zweiHalbe.grund);
    expect(zweiHalbe.wert.gutschriftMinuten).toBe(481);
  });

  it("charges no leave on a day the model has off", () => {
    const samstag = tagesSoll("2026-11-21", SANDRA, abwesend("urlaub", ["2026-11-21"]));
    if (!samstag.ok) throw new Error(samstag.grund);
    expect(samstag.wert.urlaubHalbtage).toBe(0);
  });

  it("refuses a day that is none", () => {
    expect(tagesSoll("2026-02-30", SANDRA)).toEqual({ ok: false, grund: "ungueltig" });
  });
});

describe("Auszug für die Konten", () => {
  it("lists leave per day and Kind krank on working days only", () => {
    const ergebnis = monatsstand("2026-05", {
      ...SANDRA,
      abwesenheiten: [
        ...abwesend("urlaub", tageVonBis("2026-05-11", "2026-05-15")),
        ...abwesend("kind_krank", ["2026-05-01", "2026-05-04"], { kind: "a" }),
      ],
    });
    if (!ergebnis.ok) throw new Error(ergebnis.grund);
    expect(urlaubGenommen(ergebnis.wert.tage).map((t) => t.tag)).toEqual([
      "2026-05-11",
      "2026-05-12",
      "2026-05-13",
      "2026-05-15",
    ]);
    expect(kindKrankTage(ergebnis.wert.tage)).toEqual([{ tag: "2026-05-04", kind: "a" }]);
  });
});
