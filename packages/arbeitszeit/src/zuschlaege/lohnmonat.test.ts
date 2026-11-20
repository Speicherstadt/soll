import { describe, expect, it } from "vitest";
import { minijobGrenze } from "../pruefung-lohn/minijob.ts";
import { arbeitIm, stundenlohn as lohnJeStunde, monat } from "../pruefung-lohn/testhilfen.ts";
import { tagAb } from "../pruefung-nacht-sonntag/testhilfen.ts";
import { rechne, stundenlohn } from "./testhilfen.ts";
import { alsLohnzuschlaege } from "./zuschlaege.ts";

/*
 * S-207 feeds S-204: the tax-free part of a surcharge is no Arbeitsentgelt for the mini-job limit
 * (§ 1 Abs. 1 Satz 1 Nr. 1 SvEV), now computed instead of set by hand. Olena (Café Elbblick, mini-job
 * at 14,00 € an hour) works 34 h on weekdays and 8 h on Sunday 1.11.2026 in November.
 */
const novemberMit = (sonntagssatz: number) => {
  const tage = [tagAb("2026-11-01", "10:00", 480), ...arbeitIm("2026-11-02", 34 * 60)];
  const { tage: zuschlagstage } = rechne(tage, stundenlohn(1400), { sonntag: sonntagssatz });
  const zuschlaege = alsLohnzuschlaege(zuschlagstage);
  const ergebnis = minijobGrenze([monat("2026-11", lohnJeStunde(1400), tage, { zuschlaege })]);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return { zuschlaege, befunde: ergebnis.wert.befunde };
};

describe("alsLohnzuschlaege", () => {
  it("50 % Sonntag (56,00 €) is tax-free and leaves 588,00 € under the limit of 603 €", () => {
    const { zuschlaege, befunde } = novemberMit(5000);
    expect(zuschlaege).toEqual([{ art: "sonntag", cent: 5600, steuerfrei: true }]);
    expect(befunde).toEqual([]);
  });

  it("70 % Sonntag: 22,40 € over § 3b EStG count, 610,40 € – Hinweis „gelegentlich überschritten“", () => {
    const { zuschlaege, befunde } = novemberMit(7000);
    expect(zuschlaege).toEqual([
      { art: "sonntag", cent: 5600, steuerfrei: true },
      { art: "sonntag", cent: 2240, steuerfrei: false },
    ]);
    expect(befunde.map((b) => [b.art, b.lohnCent])).toEqual([["gelegentlich", 61040]]);
  });
});
