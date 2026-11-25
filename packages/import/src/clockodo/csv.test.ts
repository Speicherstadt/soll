import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { vorschlag } from "../zuordnung.ts";
import { clockodoLesen } from "./index.ts";

/*
 * Clockodo's CSV backup of entries (S-703). The fixture follows the 27 columns and their headers as
 * the public SDK reads them: https://github.com/peerigon/clockodo/blob/main/src/models/entry.csv.ts
 * and the headers of entry.csv.test.ts there (docs.clockodo.com could not be reached).
 */

const BACKUP = readFileSync(new URL("./fixtures/eintraege-backup.csv", import.meta.url), "utf8");

describe("Clockodo's CSV backup of entries", () => {
  const { daten, fehler } = clockodoLesen(BACKUP);

  it("merges touching entries into one span and keeps a gap as the break it was", () => {
    expect(daten.zeiten).toEqual([
      // 101 and 102 touch at 11:00 (CEST): one span 7:00 to 15:30 under the first id
      {
        externalId: "101",
        zeile: 2,
        person: "Sandra Kühn",
        tag: "2026-09-01",
        beginn: 420,
        ende: 930,
        pauseMinuten: 0,
      },
      // 103 and 104 with half an hour between them: two spans, the break as clocked
      {
        externalId: "103",
        zeile: 4,
        person: "Sandra Kühn",
        tag: "2026-09-02",
        beginn: 420,
        ende: 660,
        pauseMinuten: 0,
      },
      {
        externalId: "104",
        zeile: 5,
        person: "Sandra Kühn",
        tag: "2026-09-02",
        beginn: 690,
        ende: 930,
        pauseMinuten: 0,
      },
      // 7:00:20 to 15:00:40: the begin rounded down, the end up, never shorter than clocked
      {
        externalId: "108",
        zeile: 9,
        person: "Max Brandt",
        tag: "2026-09-03",
        beginn: 420,
        ende: 901,
        pauseMinuten: 0,
      },
    ]);
  });

  it("names a running entry and a corrected duration by line; a lump sum is no time", () => {
    expect(fehler).toEqual([
      { zeile: 7, grund: "laeuft_noch", feld: "time_until" },
      { zeile: 8, grund: "korrektur", feld: "offset", wert: "600" },
    ]);
  });

  it("takes customers, projects and services from the columns of the entries, once each", () => {
    expect(daten.kunden).toEqual([
      { externalId: "201", zeile: 2, name: "Elbhof Immobilien", nummer: "" },
      { externalId: "202", zeile: 4, name: "Bäckerei Hansen", nummer: "" },
    ]);
    expect(daten.projekte).toEqual([
      { externalId: "301", zeile: 2, kunde: "201", name: "Bad Elbhof", nummer: "" },
    ]);
    expect(daten.taetigkeiten).toEqual([
      { externalId: "401", zeile: 2, name: "Montage" },
      { externalId: "402", zeile: 3, name: "Fahrt" },
    ]);
    expect(daten.abwesenheiten).toEqual([]);
  });

  it("proposes the persons by name and every service as new", () => {
    const z = vorschlag(daten, [
      { nutzerId: "u-sandra", name: "Sandra Kühn" },
      { nutzerId: "u-max", name: "Max Brandt" },
    ]);
    expect(z.personen).toEqual({ "Sandra Kühn": "u-sandra", "Max Brandt": "u-max" });
    expect(z.taetigkeiten).toEqual({});
  });

  it("reads the same file separated by semicolons, columns in another order", () => {
    const zeilen = BACKUP.trimEnd()
      .split("\r\n")
      .map((zeile: string) => zeile.split(",").reverse().join(";"));
    expect(clockodoLesen(zeilen.join("\n")).daten.zeiten).toEqual(daten.zeiten);
  });

  it("refuses a file without the columns of a backup, and an id twice", () => {
    expect(clockodoLesen("Name;Datum\nSandra;2026-09-01").fehler).toEqual([
      { zeile: 1, grund: "kein_kopf" },
    ]);
    const doppelt = `${BACKUP.trimEnd()}\r\n${BACKUP.split("\r\n")[1]}`;
    expect(clockodoLesen(doppelt).fehler).toContainEqual({
      zeile: 10,
      grund: "kennung_doppelt",
      feld: "id",
      wert: "101",
    });
  });

  it("refuses an entry in the hour that comes twice, which a clock cannot name", () => {
    const kopf = BACKUP.split("\r\n")[0];
    const zeile = (id: string, beginn: string, ende: string) =>
      `${id},11,,201,401,,60,,,,,${beginn},${ende},0,,0,0,,,,1,Sandra Kühn,,Elbhof,Montage,,`;
    // 25 October 2026: 2:00 to 3:00 comes twice; 1:30 UTC is the second 2:30
    const text = [
      kopf,
      zeile("1", "2026-10-25T00:30:00Z", "2026-10-25T00:45:00Z"),
      zeile("2", "2026-10-25T01:30:00Z", "2026-10-25T03:00:00Z"),
    ].join("\n");
    const gelesen = clockodoLesen(text);
    expect(gelesen.daten.zeiten.map((z) => [z.externalId, z.beginn, z.ende])).toEqual([
      ["1", 150, 165],
    ]);
    expect(gelesen.fehler).toEqual([{ zeile: 3, grund: "zeit_ungueltig", feld: "time_since" }]);
  });

  it("gives a night shift its day of begin and an end on the next day", () => {
    const kopf = BACKUP.split("\r\n")[0];
    const text = `${kopf}\n9,11,,201,401,,60,,,,,2026-09-01T20:00:00Z,2026-09-02T04:00:00Z,0,,0,0,,,,1,Sandra Kühn,,Elbhof,Montage,,`;
    expect(clockodoLesen(text).daten.zeiten[0]).toMatchObject({
      tag: "2026-09-01",
      beginn: 22 * 60,
      ende: 6 * 60,
    });
  });
});
