import { describe, expect, it } from "vitest";
import { tageDesZeitraums, tageUeberschneiden, ueberschneidungErlaubt } from "./zeitraum.ts";

describe("tageDesZeitraums", () => {
  it("gives every day from von to bis, both included", () => {
    expect(
      tageDesZeitraums({ art: "urlaub", von: "2026-12-30", bis: "2027-01-01" }).map((a) => a.tag),
    ).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });

  it("marks the first and the last day half as entered", () => {
    const tage = tageDesZeitraums({
      art: "urlaub",
      von: "2026-08-03",
      bis: "2026-08-05",
      ersterHalb: true,
      letzterHalb: true,
    });
    expect(tage.map((a) => a.halb === true)).toEqual([true, false, true]);
  });

  it("makes a single day half when either half is set", () => {
    expect(
      tageDesZeitraums({ art: "urlaub", von: "2026-08-03", bis: "2026-08-03", letzterHalb: true }),
    ).toEqual([{ tag: "2026-08-03", art: "urlaub", halb: true }]);
  });

  it("carries the certificate and the child, nothing else", () => {
    expect(
      tageDesZeitraums({ art: "kind_krank", von: "2026-03-02", bis: "2026-03-02", kind: "1" }),
    ).toEqual([{ tag: "2026-03-02", art: "kind_krank", kind: "1" }]);
    expect(
      tageDesZeitraums({ art: "krank", von: "2026-03-02", bis: "2026-03-02", bescheinigung: true }),
    ).toEqual([{ tag: "2026-03-02", art: "krank", bescheinigung: true }]);
  });

  it("counts an open sickness up to the day given, and nothing before it began", () => {
    expect(
      tageDesZeitraums({ art: "krank", von: "2026-11-18", bis: null }, "2026-11-20").length,
    ).toBe(3);
    expect(tageDesZeitraums({ art: "krank", von: "2026-11-21", bis: null }, "2026-11-20")).toEqual(
      [],
    );
  });

  it("gives nothing for a span that ends before it begins", () => {
    expect(tageDesZeitraums({ art: "urlaub", von: "2026-08-05", bis: "2026-08-03" })).toEqual([]);
  });
});

describe("Überschneidungen", () => {
  const urlaub = { art: "urlaub" as const, von: "2026-08-03", bis: "2026-08-07" };
  it("finds two spans with a common day, an open end reaches on", () => {
    expect(tageUeberschneiden(urlaub, { von: "2026-08-07", bis: "2026-08-10" })).toBe(true);
    expect(tageUeberschneiden(urlaub, { von: "2026-08-08", bis: null })).toBe(false);
    expect(tageUeberschneiden({ von: "2026-08-01", bis: null }, urlaub)).toBe(true);
  });

  it("allows sickness in leave only (§ 9 BUrlG)", () => {
    expect(ueberschneidungErlaubt("krank", "urlaub")).toBe(true);
    expect(ueberschneidungErlaubt("urlaub", "krank")).toBe(true);
    expect(ueberschneidungErlaubt("urlaub", "urlaub")).toBe(false);
    expect(ueberschneidungErlaubt("kind_krank", "urlaub")).toBe(false);
    expect(ueberschneidungErlaubt("krank", "sonderurlaub")).toBe(false);
  });
});
