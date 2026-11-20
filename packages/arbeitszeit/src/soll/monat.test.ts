import { describe, expect, it } from "vitest";
import type { Monat } from "../kalender/monat.ts";
import { type MonatsEingaben, monatsstand } from "./monat.ts";
import {
  abwesend,
  gearbeitet,
  HAMBURG,
  hm,
  modell,
  SANDRA,
  tageVonBis,
  werktageMoFr,
} from "./testhilfen.ts";

const stand = (monat: Monat, eingaben: Partial<MonatsEingaben> = {}) => {
  const ergebnis = monatsstand(monat, { ...SANDRA, ...eingaben });
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

/*
 * docs/regeln.md, R-33 (cases taken literally): Weber Haustechnik in Hamburg, model Mo–Fr 8:00.
 */
describe("R-33: Soll und Ist eines Monats", () => {
  it("erlaubt: November 2026, 7:30 on every working day – Soll 168:00, Ist 157:30, Saldo −10:30", () => {
    const monat = stand("2026-11", {
      arbeitstage: gearbeitet(werktageMoFr("2026-11"), hm("7:30")),
    });
    expect(werktageMoFr("2026-11")).toHaveLength(21);
    expect(monat.sollMinuten).toBe(hm("168:00"));
    expect(monat.istMinuten).toBe(hm("157:30"));
    expect(monat.saldoMinuten).toBe(hm("−10:30"));
  });

  it("Grenze: November 2026, 8:00 on every working day – Soll 168:00, Ist 168:00, Saldo 0:00", () => {
    const monat = stand("2026-11", {
      arbeitstage: gearbeitet(werktageMoFr("2026-11"), hm("8:00")),
    });
    expect([monat.sollMinuten, monat.istMinuten, monat.saldoMinuten]).toEqual([
      hm("168:00"),
      hm("168:00"),
      0,
    ]);
  });

  it("Verstoß: November 2026, 9:00 on every working day – Ist 189:00, 21:00 over the Soll", () => {
    const monat = stand("2026-11", {
      arbeitstage: gearbeitet(werktageMoFr("2026-11"), hm("9:00")),
    });
    expect(monat.istMinuten).toBe(hm("189:00"));
    expect(monat.saldoMinuten).toBe(hm("21:00"));
  });

  it("Feiertag: May 2026 (1.5., 14.5., 25.5.) – Soll 144:00 (18 working days), Ausfall 24:00", () => {
    const monat = stand("2026-05");
    expect(monat.sollMinuten).toBe(hm("144:00"));
    expect(monat.tage.filter((tag) => tag.sollMinuten > 0)).toHaveLength(18);
    expect(monat.tage.reduce((summe, tag) => summe + tag.ausfallMinuten, 0)).toBe(hm("24:00"));
    expect(monat.tage.filter((tag) => tag.feiertag !== null).map((tag) => tag.tag)).toEqual([
      "2026-05-01",
      "2026-05-14",
      "2026-05-25",
    ]);
  });

  it("Feiertag am freien Tag: October 2026 (3.10. and 31.10. are Saturdays) – Soll 176:00", () => {
    const monat = stand("2026-10");
    expect(monat.sollMinuten).toBe(hm("176:00"));
    expect(monat.tage.reduce((summe, tag) => summe + tag.ausfallMinuten, 0)).toBe(0);
    // looked up only where the model has minutes: the Saturday holidays take nothing
    expect(monat.tage.find((tag) => tag.tag === "2026-10-31")?.feiertag).toBeNull();
  });

  it("Modellwechsel: from Mo 16.11.2026 Mo–Do 6:00 – Soll 134:00 (10 × 8:00 + 9 × 6:00)", () => {
    const monat = stand("2026-11", {
      modelle: [modell("2026-01-01"), modell("2026-11-16", [360, 360, 360, 360, 0, 0, 0])],
    });
    expect(monat.sollMinuten).toBe(hm("134:00"));
    expect(monat.tage.find((tag) => tag.tag === "2026-11-13")?.sollMinuten).toBe(480);
    expect(monat.tage.find((tag) => tag.tag === "2026-11-16")?.sollMinuten).toBe(360);
    expect(monat.tage.find((tag) => tag.tag === "2026-11-20")?.sollMinuten).toBe(0);
  });

  it("Eintritt: Wed 18.11.2026 – Soll 72:00 (9 working days from 18.11.)", () => {
    const monat = stand("2026-11", {
      modelle: [modell("2026-11-18")],
      beschaeftigung: { eintritt: "2026-11-18" },
    });
    expect(monat.sollMinuten).toBe(hm("72:00"));
  });

  it("Urlaub: Mo 9.11. – Fr 13.11.2026 – 128:00 worked + 40:00 credited = 168:00, 5 days", () => {
    const urlaub = tageVonBis("2026-11-09", "2026-11-13");
    const monat = stand("2026-11", {
      abwesenheiten: abwesend("urlaub", urlaub),
      arbeitstage: gearbeitet(werktageMoFr("2026-11", urlaub), hm("8:00")),
    });
    expect(monat.gearbeitetMinuten).toBe(hm("128:00"));
    expect(monat.gutschriftMinuten).toBe(hm("40:00"));
    expect(monat.istMinuten).toBe(hm("168:00"));
    expect(monat.urlaubHalbtage).toBe(10);
  });

  it("Urlaub am Feiertag: Mo 11.5. – Fr 15.5.2026 (Thu 14.5. Himmelfahrt) – 4 days, 32:00", () => {
    const monat = stand("2026-05", {
      abwesenheiten: abwesend("urlaub", tageVonBis("2026-05-11", "2026-05-15")),
    });
    expect(monat.urlaubHalbtage).toBe(8);
    expect(monat.gutschriftMinuten).toBe(hm("32:00"));
  });

  it("halber Tag: Fr 7:15, half a day of leave on Fr 27.11.2026 – 3:38 credited, 0,5 days", () => {
    const monat = stand("2026-11", {
      modelle: [modell("2026-01-01", [480, 480, 480, 480, 435, 0, 0])],
      abwesenheiten: abwesend("urlaub", ["2026-11-27"], { halb: true }),
    });
    expect(monat.gutschriftMinuten).toBe(hm("3:38"));
    expect(monat.urlaubHalbtage).toBe(1);
  });

  it("krank: Mo 2.11. – Mi 4.11.2026 – 24:00 credited", () => {
    const monat = stand("2026-11", {
      abwesenheiten: abwesend("krank", tageVonBis("2026-11-02", "2026-11-04")),
    });
    expect(monat.gutschriftMinuten).toBe(hm("24:00"));
    expect(monat.urlaubHalbtage).toBe(0);
  });

  it("Überstundenabbau: Fr 6.11.2026 – 0:00 credited, Saldo −8:00", () => {
    const monat = stand("2026-11", {
      abwesenheiten: abwesend("ueberstundenabbau", ["2026-11-06"]),
      arbeitstage: gearbeitet(werktageMoFr("2026-11", ["2026-11-06"]), hm("8:00")),
    });
    expect(monat.gutschriftMinuten).toBe(0);
    expect(monat.saldoMinuten).toBe(hm("−8:00"));
  });
});

describe("Soll eines Monats: Beschäftigung, Grenzen und nicht hinterlegt", () => {
  it("counts from an Eintritt on the 1st and up to an Austritt on the last day", () => {
    expect(stand("2026-11", { beschaeftigung: { eintritt: "2026-11-01" } }).sollMinuten).toBe(
      hm("168:00"),
    );
    expect(
      stand("2026-11", { beschaeftigung: { eintritt: "2024-04-01", austritt: "2026-11-30" } })
        .sollMinuten,
    ).toBe(hm("168:00"));
  });

  it("counts the day of Austritt mid-month and nothing after it", () => {
    // Austritt Fr 13.11.2026: 2.–6. and 9.–13.11.
    const monat = stand("2026-11", {
      beschaeftigung: { eintritt: "2024-04-01", austritt: "2026-11-13" },
    });
    expect(monat.sollMinuten).toBe(hm("80:00"));
  });

  it("has no Soll while the employment rests (full Elternzeit)", () => {
    const monat = stand("2026-11", {
      beschaeftigung: { eintritt: "2024-04-01", ruhend: [{ von: "2026-11-16", bis: null }] },
    });
    expect(monat.sollMinuten).toBe(hm("80:00"));
  });

  it("follows February of a leap year to its 29th day", () => {
    // February 2028: 1.2. is a Tuesday; Mo–Fr are 21 days, the 29th a Tuesday
    expect(stand("2028-02").sollMinuten).toBe(21 * 480);
    expect(stand("2027-02").sollMinuten).toBe(20 * 480);
  });

  it("is nicht hinterlegt on every day of the employment without a model, naming the days", () => {
    const ergebnis = monatsstand("2026-11", { ...SANDRA, modelle: [modell("2026-11-28")] });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok || ergebnis.grund !== "nicht_hinterlegt") throw new Error("erwartet");
    expect(ergebnis.tage[0]).toBe("2026-11-01");
    expect(ergebnis.tage.at(-1)).toBe("2026-11-27");
  });

  it("is nicht hinterlegt in a year without holidays, but not on days the model has off", () => {
    const vorher = { modelle: [modell("1994-01-01")], beschaeftigung: { eintritt: "1990-01-01" } };
    const ergebnis = monatsstand("1994-11", { ...SANDRA, ...vorher });
    expect(ergebnis.ok).toBe(false);
    const nurSonntags = { ...vorher, modelle: [modell("1994-01-01", [0, 0, 0, 0, 0, 0, 0])] };
    expect(monatsstand("1994-11", { ...SANDRA, ...nurSonntags }).ok).toBe(true);
  });

  it("refuses an invalid month, model or absence", () => {
    expect(monatsstand("2026-13", SANDRA)).toEqual({ ok: false, grund: "ungueltig" });
    const halbeMinute = [480.5, 480, 480, 480, 480, 0, 0];
    expect(
      monatsstand("2026-11", { ...SANDRA, modelle: [modell("2026-01-01", halbeMinute)] }).ok,
    ).toBe(false);
    const doppelt = [
      ...abwesend("urlaub", ["2026-11-02"]),
      ...abwesend("sonderurlaub", ["2026-11-02"]),
    ];
    expect(monatsstand("2026-11", { ...SANDRA, abwesenheiten: doppelt })).toEqual({
      ok: false,
      grund: "ungueltig",
    });
  });

  it("counts work on a holiday as Ist over a Soll of 0", () => {
    const monat = stand("2026-05", { arbeitstage: gearbeitet(["2026-05-01"], 300) });
    expect(monat.tage[0]?.sollMinuten).toBe(0);
    expect(monat.istMinuten).toBe(300);
  });

  it("names a day with an open shift and leaves its time out", () => {
    const [offen] = gearbeitet(["2026-11-02"], 480);
    if (offen === undefined) throw new Error("erwartet");
    const schicht = { ...offen.schichten[0], ende: null } as (typeof offen.schichten)[number];
    const monat = stand("2026-11", { arbeitstage: [{ tag: "2026-11-02", schichten: [schicht] }] });
    expect(monat.offeneTage).toEqual(["2026-11-02"]);
    expect(monat.gearbeitetMinuten).toBe(0);
  });

  it("uses the holidays of the person's place", () => {
    // Buß- und Bettag, Wed 18.11.2026, is a holiday in Saxony only (§ 1 SächsSFG)
    const sachsen = stand("2026-11", { standort: { land: "SN" } });
    expect(sachsen.sollMinuten).toBe(hm("160:00"));
    expect(stand("2026-11", { standort: HAMBURG }).sollMinuten).toBe(hm("168:00"));
  });
});
