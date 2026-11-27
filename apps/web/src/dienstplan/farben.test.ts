import { describe, expect, test } from "vitest";
import {
  monatKalenderTage,
  plusMonatTag,
  schichtFarbe,
  tagMinuten,
  vorlageFarbe,
} from "./farben.ts";
import type { Schicht, Vorlage } from "./typen.ts";

const VORLAGEN: Vorlage[] = [
  {
    vorlageId: "v1",
    name: "Tagschicht",
    beginnMinute: 420,
    endeMinute: 930,
    pauseMinuten: 30,
    rolle: "Montage",
    standortId: "st1",
  },
  {
    vorlageId: "v2",
    name: "Kundendienst",
    beginnMinute: 480,
    endeMinute: 990,
    pauseMinuten: 30,
    rolle: "Service",
    standortId: "st1",
  },
];

describe("dienstplan/farben", () => {
  test("assigns matching colors to shifts and their templates, and dashed amber to open shifts", () => {
    const s1: Schicht = {
      schichtId: "s1",
      standortId: "st1",
      tag: "2026-11-23",
      beginn: Date.parse("2026-11-23T07:00:00+01:00"),
      ende: Date.parse("2026-11-23T15:30:00+01:00"),
      pauseMinuten: 30,
      rolle: "Montage",
      nutzerId: "jonas",
      vorlageId: "v1",
      veroeffentlichtAm: null,
    };
    const s2: Schicht = { ...s1, schichtId: "s2", vorlageId: "v2", rolle: "Service" };
    const offen: Schicht = { ...s1, schichtId: "s3", nutzerId: null };

    const [v1, v2] = VORLAGEN;
    expect(v1 && v2).toBeTruthy();
    if (v1 && v2) {
      expect(schichtFarbe(s1, VORLAGEN)).toEqual(vorlageFarbe(v1, 0));
      expect(schichtFarbe(s2, VORLAGEN)).toEqual(vorlageFarbe(v2, 1));
    }
    expect(schichtFarbe(s1, VORLAGEN).punkt).not.toBe(schichtFarbe(s2, VORLAGEN).punkt);
    expect(schichtFarbe(offen, VORLAGEN).karte).toContain("border-dashed");
  });

  test("builds full Mon-Sun month calendar weeks and steps months cleanly", () => {
    const nov = monatKalenderTage("2026-11-23");
    expect(nov.monat).toBe("2026-11");
    expect(nov.tage.length % 7).toBe(0);
    expect(nov.tage[0]).toBe("2026-10-26");
    expect(nov.tage.at(-1)).toBe("2026-12-06");
    expect(nov.montage).toEqual([
      "2026-10-26",
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]);
    expect(plusMonatTag("2026-11-23", 1)).toBe("2026-12-01");
    expect(plusMonatTag("2026-01-15", -1)).toBe("2025-12-01");
  });

  test("computes Berlin clock minutes for timeline positioning", () => {
    expect(tagMinuten(Date.parse("2026-11-23T07:30:00+01:00"))).toBe(450);
    expect(tagMinuten(Date.parse("2026-07-15T16:15:00+02:00"))).toBe(975);
  });
});
