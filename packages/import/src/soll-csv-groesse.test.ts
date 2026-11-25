import { describe, expect, it } from "vitest";
import { sollCsvLesen } from "./soll-csv.ts";
import { inZeit } from "./zeit-testhilfen.ts";

/** The largest file the server accepts (apps/server/src/modules/umzug/datei.ts) */
const MAX_BYTES = 5 * 1024 * 1024;

describe("the reader stays within 1 s for any file the server accepts", () => {
  for (const [name, zeichen] of [
    ["semicolons", ";"],
    ["tabs", "\t"],
    ["commas", ","],
  ] as const)
    it(`a header line of 5 MiB of ${name}`, () => {
      const text = zeichen.repeat(MAX_BYTES);
      const gelesen = inZeit(() => sollCsvLesen(text));
      expect(gelesen.fehler).toEqual([{ zeile: 1, grund: "kein_kopf" }]);
    });

  const KOPF = "Typ;Kennung;Person;Datum;Beginn;Ende;Pause;Bis;Art;Kunde;Name;Nummer\n";
  for (const [name, rest] of [
    ["a data line of separators", ";".repeat(MAX_BYTES)],
    ["a quote never closed", '"'.repeat(MAX_BYTES)],
    ["empty lines", "\n".repeat(MAX_BYTES)],
    ["one long field", "x".repeat(MAX_BYTES)],
    ["many short records", "zeit;z;S;01.09.2026;7:00;8:00\n".repeat(MAX_BYTES / 32)],
  ] as const)
    it(`after a valid header: ${name}`, () => {
      inZeit(() => sollCsvLesen(KOPF + rest));
    });
});
