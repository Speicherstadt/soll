import { describe, expect, it } from "vitest";
import { hoechstarbeitszeit } from "../pruefung/hoechstarbeitszeit.ts";
import { tage } from "../pruefung/testhilfen.ts";
import { bereitschaftstage } from "./bereitschaftstage.ts";
import { SPAETER, schicht, um } from "./testhilfen.ts";
import { mitStempeltagen } from "./zuordnung.ts";

/* A finding of a joined shift names the days its stamped work lies on too (review of S-505) */

describe("mitStempeltagen", () => {
  it("call-out 31.10. 23:30 – 23:50 joined to work 1.11. 0:00 – 10:40: § 3 names both days", () => {
    const gestempelt = tage(schicht("2026-11-01T00:00+01:00", "2026-11-01T10:40+01:00"), SPAETER);
    const verbunden = bereitschaftstage(gestempelt, {
      einsaetze: [{ beginn: um("2026-10-31T23:30+01:00"), ende: um("2026-10-31T23:50+01:00") }],
    });
    if (!verbunden.ok) throw new Error(verbunden.grund);
    const { befunde } = hoechstarbeitszeit(verbunden.wert);
    expect(befunde.map((b) => b.tage)).toEqual([["2026-10-31"]]);
    expect(mitStempeltagen(befunde, gestempelt, verbunden.wert).map((b) => b.tage)).toEqual([
      ["2026-10-31", "2026-11-01"],
    ]);
  });

  it("leaves findings alone where no stamped work changed its day", () => {
    const gestempelt = tage(schicht("2026-11-02T06:00+01:00", "2026-11-02T17:00+01:00"), SPAETER);
    const { befunde } = hoechstarbeitszeit(gestempelt);
    expect(mitStempeltagen(befunde, gestempelt, gestempelt)).toEqual(befunde);
  });
});
