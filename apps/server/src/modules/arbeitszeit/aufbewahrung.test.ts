import type { Lohnmodell } from "@soll/export";
import { describe, expect, it } from "vitest";
import { aufbewahrungsjahre, aussonderbarAb } from "./aufbewahrung.ts";

const um = (text: string) => Date.parse(text);

const modell = (mehr: Partial<Lohnmodell> = {}): Lohnmodell => ({
  ab: "2026-01-01",
  sollMinuten: [480, 480, 480, 480, 480, 0, 0],
  lohnArt: "monat",
  lohnCent: 350_000,
  minijob: false,
  zuschlagssaetze: {},
  ...mehr,
});

describe("retention period of a closed month (docs/plan.md, Aufbewahrung je Monatsabschluss)", () => {
  it("is 2 years for a fixed monthly wage without surcharges: nothing is posted from the times", () => {
    expect(aufbewahrungsjahre([modell()], "2026-10")).toBe(2);
    expect(aufbewahrungsjahre([modell({ lohnCent: null })], "2026-10")).toBe(2);
    expect(aufbewahrungsjahre([modell({ zuschlagssaetze: { nacht: 0 } })], "2026-10")).toBe(2);
  });

  it("is 8 years when the times are posted to payroll: hourly wage, mini-job or surcharges", () => {
    expect(aufbewahrungsjahre([modell({ lohnArt: "stunde" })], "2026-10")).toBe(8);
    expect(aufbewahrungsjahre([modell({ minijob: true })], "2026-10")).toBe(8);
    expect(aufbewahrungsjahre([modell({ zuschlagssaetze: { nacht: 2500 } })], "2026-10")).toBe(8);
  });

  it("is 8 years when one day of the month has such a model or none at all", () => {
    const wechsel = [modell(), modell({ ab: "2026-10-31", lohnArt: "stunde" })];
    expect(aufbewahrungsjahre(wechsel, "2026-10")).toBe(8);
    expect(aufbewahrungsjahre(wechsel, "2026-09")).toBe(2);
    expect(aufbewahrungsjahre([modell({ ab: "2026-10-02" })], "2026-10")).toBe(8);
    expect(aufbewahrungsjahre([], "2026-10")).toBe(8);
  });

  it("starts with the end of the calendar year the month was closed in", () => {
    expect(aussonderbarAb(um("2026-11-20T09:00:00+01:00"), 2)).toBe("2029-01-01");
    expect(aussonderbarAb(um("2027-01-05T09:00:00+01:00"), 8)).toBe("2036-01-01");
    // 23:30 UTC on 31 December is already New Year's Day in Berlin
    expect(aussonderbarAb(um("2026-12-31T23:30:00Z"), 2)).toBe("2030-01-01");
  });
});

/** The cases of R-10 in docs/regeln.md: whether a month is removed on a day */
describe("R-10 Aufzeichnung und Aufbewahrung (§ 16 Abs. 2 ArbZG, § 147 AO)", () => {
  const entfernt = (
    monat: string,
    abgeschlossen: string,
    modelle: Lohnmodell[],
    tag: string,
  ): boolean => aussonderbarAb(um(abgeschlossen), aufbewahrungsjahre(modelle, monat)) <= tag;

  it("erlaubt: January 2026 without payroll, closed in February, removed on 1 January 2029", () => {
    expect(entfernt("2026-01", "2026-02-03T09:00:00+01:00", [modell()], "2029-01-01")).toBe(true);
  });

  it("Grenze: December 2026 without payroll is not removed on 31 December 2028", () => {
    expect(entfernt("2026-12", "2026-12-31T18:00:00+01:00", [modell()], "2028-12-31")).toBe(false);
    // closed in January 2027, the period starts with the end of 2027
    expect(entfernt("2026-12", "2027-01-05T09:00:00+01:00", [modell()], "2029-12-31")).toBe(false);
    expect(entfernt("2026-12", "2027-01-05T09:00:00+01:00", [modell()], "2030-01-01")).toBe(true);
  });

  it("Verstoß: a month of 2026 is never removed in 2027", () => {
    expect(entfernt("2026-01", "2026-02-03T09:00:00+01:00", [modell()], "2027-12-31")).toBe(false);
  });

  it("Buchungsbeleg: January 2026 with an hourly wage stays until the end of 2034", () => {
    const stunde = [modell({ lohnArt: "stunde" })];
    expect(entfernt("2026-01", "2026-02-03T09:00:00+01:00", stunde, "2029-01-01")).toBe(false);
    expect(entfernt("2026-01", "2026-02-03T09:00:00+01:00", stunde, "2034-12-31")).toBe(false);
    expect(entfernt("2026-01", "2026-02-03T09:00:00+01:00", stunde, "2035-01-01")).toBe(true);
  });
});
