import { describe, expect, it } from "vitest";
import { ALLE, pruefexportPfad, startZeitraum, zeitraumGueltig } from "./zeitraum.ts";

describe("startZeitraum", () => {
  it("is the month before this one in Berlin, also on New Year's night", () => {
    expect(startZeitraum(Date.parse("2026-11-20T09:00:00+01:00"))).toEqual({
      anfang: "2026-10-01",
      ende: "2026-10-31",
    });
    // 23:30 UTC on 31 December is already January in Berlin
    expect(startZeitraum(Date.parse("2026-12-31T23:30:00Z"))).toEqual({
      anfang: "2026-12-01",
      ende: "2026-12-31",
    });
  });
});

describe("zeitraumGueltig", () => {
  it("takes a period from the first day to the last of at most two years", () => {
    expect(zeitraumGueltig("2026-10-01", "2026-10-01")).toBe(true);
    expect(zeitraumGueltig("2024-10-02", "2026-10-01")).toBe(true);
    expect(zeitraumGueltig("2024-10-01", "2026-10-02")).toBe(false);
    expect(zeitraumGueltig("2026-11-01", "2026-10-01")).toBe(false);
    expect(zeitraumGueltig("", "2026-10-01")).toBe(false);
  });
});

describe("pruefexportPfad", () => {
  const basis = { anfang: "2026-10-01", ende: "2026-10-31", format: "csv" as const };
  it("asks for oneself without a choice", () => {
    expect(pruefexportPfad({ ...basis, wahl: "", personen: ["a", "b"] })).toBe(
      "/api/v1/arbeitszeit/pruefexport?von=2026-10-01&bis=2026-10-31&format=csv",
    );
  });
  it("names everyone in the list, or the one chosen", () => {
    expect(pruefexportPfad({ ...basis, wahl: ALLE, personen: ["a", "b"] })).toBe(
      "/api/v1/arbeitszeit/pruefexport?von=2026-10-01&bis=2026-10-31&format=csv&nutzerId=a&nutzerId=b",
    );
    expect(pruefexportPfad({ ...basis, format: "pdf", wahl: "b", personen: ["a", "b"] })).toBe(
      "/api/v1/arbeitszeit/pruefexport?von=2026-10-01&bis=2026-10-31&format=pdf&nutzerId=b",
    );
  });
});
