import { describe, expect, test } from "vitest";
import {
  datumAnzeigen,
  datumGueltig,
  datumLang,
  einheitName,
  kalenderGitter,
  kalenderNachbar,
  minuteDrehen,
  monatVerschieben,
  popoverPosition,
  stundeDrehen,
  wochentagKuerzel,
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

  test("validates YYYY-MM-DD format, calendar existence, and min/max bounds", () => {
    expect(datumGueltig("")).toBe("");
    expect(datumGueltig("2026-11-15", "2026-11-01", "2026-11-30")).toBe("");
    expect(datumGueltig("not-a-date")).toBe("format");
    expect(datumGueltig("2026-02-30")).toBe("format");
    expect(datumGueltig("2020-01-01", "2026-01-01")).toBe("min");
    expect(datumGueltig("2027-01-01", undefined, "2026-12-31")).toBe("max");
  });

  test("produces 7 distinct weekday headers in de and ar", () => {
    expect(new Set(wochentagKuerzel("de")).size).toBe(7);
    expect(new Set(wochentagKuerzel("ar")).size).toBe(7);
  });

  test("wraps hour and minute steppers at 0/23 and 0/59", () => {
    expect(stundeDrehen(23, 1)).toBe(0);
    expect(stundeDrehen(0, -1)).toBe(23);
    expect(minuteDrehen(59, 1)).toBe(0);
    expect(minuteDrehen(0, -1)).toBe(59);
  });

  test("formats ISO dates into the active locale", () => {
    expect(datumAnzeigen("2026-11-27", "de")).toBe("27.11.2026");
    expect(datumAnzeigen("2026-11-27", "en-US")).toBe("11/27/2026");
    expect(datumAnzeigen("", "de")).toBe("");
  });

  test("returns localized date/time field names and full accessible date labels (#119)", () => {
    expect(einheitName("month", "de")).toBe("Monat");
    expect(einheitName("year", "en")).toBe("year");
    expect(einheitName("hour", "de")).toBe("Stunde");
    expect(datumLang("2026-11-27", "de")).toContain("2026");
    expect(datumLang("2026-11-27", "de")).toContain("27");
  });

  test("moves across the 42-cell calendar grid with arrow keys in LTR and RTL (#119)", () => {
    expect(kalenderNachbar(10, "ArrowRight", false)).toBe(11);
    expect(kalenderNachbar(10, "ArrowLeft", false)).toBe(9);
    expect(kalenderNachbar(10, "ArrowRight", true)).toBe(9);
    expect(kalenderNachbar(10, "ArrowLeft", true)).toBe(11);
    expect(kalenderNachbar(10, "ArrowDown", false)).toBe(17);
    expect(kalenderNachbar(10, "ArrowUp", false)).toBe(3);
    expect(kalenderNachbar(10, "Home", false)).toBe(7);
    expect(kalenderNachbar(10, "End", false)).toBe(13);
    expect(kalenderNachbar(0, "ArrowUp", false)).toBeUndefined();
    expect(kalenderNachbar(41, "ArrowRight", false)).toBeUndefined();
  });
});
