import { describe, expect, it } from "vitest";
import { hm } from "../soll/testhilfen.ts";
import { type Abschluss, type KontoAnpassung, ueberstundenkonto } from "./ueberstunden.ts";

const abschluss = (monat: string, soll: string, ist: string): Abschluss => ({
  monat,
  sollMinuten: hm(soll),
  istMinuten: hm(ist),
});

const konto = (abschluesse: Abschluss[], anpassungen: KontoAnpassung[] = [], bis?: string) => {
  const ergebnis = ueberstundenkonto(abschluesse, anpassungen, bis);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

describe("R-33: Überstundenkonto aus den Abschlüssen", () => {
  it("Überstundenkonto: Startsaldo 10:00 on 1.10.2026, October +2:00, November −1:30, payout 5:00 in November – Saldo 5:30", () => {
    const ergebnis = konto(
      [abschluss("2026-10", "176:00", "178:00"), abschluss("2026-11", "168:00", "166:30")],
      [
        { monat: "2026-10", art: "startsaldo", minuten: hm("10:00") },
        { monat: "2026-11", art: "auszahlung", minuten: hm("5:00") },
      ],
    );
    expect(ergebnis.saldoMinuten).toBe(hm("5:30"));
    expect(ergebnis.verlauf).toEqual([
      { monat: "2026-10", differenzMinuten: 120, anpassungMinuten: 600, saldoMinuten: 720 },
      { monat: "2026-11", differenzMinuten: -90, anpassungMinuten: -300, saldoMinuten: 330 },
    ]);
  });

  it("starts at 0 without closings or adjustments", () => {
    expect(konto([])).toEqual({ saldoMinuten: 0, verlauf: [], luecken: [] });
  });

  it("carries a negative balance and corrections in both directions", () => {
    const ergebnis = konto(
      [abschluss("2026-11", "168:00", "157:30")],
      [
        { monat: "2026-11", art: "korrektur", minuten: 30 },
        { monat: "2026-12", art: "korrektur", minuten: -15 },
      ],
    );
    expect(ergebnis.saldoMinuten).toBe(hm("−10:15"));
  });

  it("stops at the end of a month and names months missing between closings", () => {
    const abschluesse = [
      abschluss("2026-09", "176:00", "177:00"),
      abschluss("2026-11", "168:00", "169:00"),
      abschluss("2027-01", "160:00", "161:00"),
    ];
    expect(konto(abschluesse, [], "2026-11")).toMatchObject({
      saldoMinuten: 120,
      luecken: ["2026-10"],
    });
    expect(konto(abschluesse).luecken).toEqual(["2026-10", "2026-12"]);
  });

  it("names the months from the start balance to the first closing that are not closed", () => {
    // the start balance is the balance at the start of 2026-08; August and September are missing
    const ergebnis = konto(
      [abschluss("2026-10", "176:00", "177:00")],
      [{ monat: "2026-08", art: "startsaldo", minuten: hm("10:00") }],
    );
    expect(ergebnis.luecken).toEqual(["2026-08", "2026-09"]);
  });

  it("crosses the turn of the year", () => {
    const ergebnis = konto([
      abschluss("2026-12", "160:00", "170:00"),
      abschluss("2027-01", "168:00", "160:00"),
    ]);
    expect(ergebnis.saldoMinuten).toBe(120);
    expect(ergebnis.luecken).toEqual([]);
  });

  it("refuses two closings of a month, two start balances, entries before the start and a negative payout", () => {
    const okt = abschluss("2026-10", "176:00", "176:00");
    const start = (monat: string): KontoAnpassung => ({ monat, art: "startsaldo", minuten: 60 });
    expect(ueberstundenkonto([okt, okt]).ok).toBe(false);
    expect(ueberstundenkonto([], [start("2026-10"), start("2026-11")]).ok).toBe(false);
    expect(ueberstundenkonto([okt], [start("2026-11")]).ok).toBe(false);
    expect(ueberstundenkonto([], [{ monat: "2026-11", art: "auszahlung", minuten: -60 }]).ok).toBe(
      false,
    );
    expect(ueberstundenkonto([{ monat: "2026-11", sollMinuten: 0.5, istMinuten: 0 }]).ok).toBe(
      false,
    );
    expect(ueberstundenkonto([], [], "2026-13").ok).toBe(false);
  });
});
