import { describe, expect, test } from "vitest";
import {
  kalenderGitter,
  monatVerschieben,
  popoverPosition,
  zeitFormatieren,
  zeitTeilen,
} from "./pickerDaten.ts";

describe("pickerDaten", () => {
  test("builds 42 Mon-Sun cells and disables dates outside min/max", () => {
    const zellen = kalenderGitter(2026, 10, "2026-11-10", "2026-11-20"); // Nov 2026
    expect(zellen).toHaveLength(42);
    expect(zellen[0]?.tag).toBe("2026-10-26");
    expect(zellen[0]?.imMonat).toBe(false);
    expect(zellen.find((z) => z.tag === "2026-11-09")?.deaktiviert).toBe(true);
    expect(zellen.find((z) => z.tag === "2026-11-10")?.deaktiviert).toBe(false);
    expect(zellen.find((z) => z.tag === "2026-11-20")?.deaktiviert).toBe(false);
    expect(zellen.find((z) => z.tag === "2026-11-21")?.deaktiviert).toBe(true);
  });

  test("steps months across year boundaries cleanly", () => {
    expect(monatVerschieben(2026, 0, -1)).toEqual({ jahr: 2025, monat: 11 });
    expect(monatVerschieben(2026, 11, 1)).toEqual({ jahr: 2027, monat: 0 });
  });

  test("parses and formats HH:MM values", () => {
    expect(zeitTeilen("08:30")).toEqual({ stunde: 8, minute: 30 });
    expect(zeitTeilen("25:00")).toBeNull();
    expect(zeitFormatieren(7, 5)).toBe("07:05");
  });

  test("positions popover below, flips upward near bottom, and clamps right edge", () => {
    expect(
      popoverPosition({ top: 100, bottom: 136, left: 200, right: 360 }, 268, 304, 1280, 800),
    ).toEqual({
      top: 142,
      left: 200,
    });
    expect(
      popoverPosition({ top: 650, bottom: 686, left: 1100, right: 1260 }, 268, 304, 1280, 800),
    ).toEqual({
      top: 340,
      left: 1004,
    });
  });
});
