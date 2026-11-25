import { describe, expect, it } from "vitest";
import { TABELLE_VORLAGE_CSV, tabelleVorlageXlsx } from "./vorlage.ts";

describe("the templates of a spreadsheet of times (S-702)", () => {
  it("are the same bytes on every call", () => {
    expect(tabelleVorlageXlsx()).toEqual(tabelleVorlageXlsx());
    expect(new TextEncoder().encode(TABELLE_VORLAGE_CSV)).toEqual(
      new TextEncoder().encode(TABELLE_VORLAGE_CSV),
    );
  });

  it("stamps every entry 1 January 2026, 00:00, whatever the time zone of the machine", () => {
    const zip = tabelleVorlageXlsx();
    const u16 = (i: number) => (zip[i] ?? 0) | ((zip[i + 1] ?? 0) << 8);
    // the first local file header: DOS time at offset 10, DOS date at 12 (APPNOTE 4.4.6)
    expect(u16(10)).toBe(0);
    expect(u16(12)).toBe(((2026 - 1980) << 9) | (1 << 5) | 1);
  });

  it("starts the CSV with a byte order mark and the header Excel shows", () => {
    expect(
      TABELLE_VORLAGE_CSV.startsWith("﻿Person;Datum;Beginn;Ende;Pause;Projekt;Tätigkeit\r\n"),
    ).toBe(true);
  });
});
