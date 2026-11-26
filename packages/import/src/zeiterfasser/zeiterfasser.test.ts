import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { quelleVon } from "../quellen.ts";
import { PETERSEN } from "./fixtures/index.ts";
import { clockifyAbzugText, clockifyLesen, togglAbzugText, togglLesen } from "./index.ts";

/*
 * Tests for Toggl Track and Clockify (BAULISTE.md S-707):
 * - Toggl Track OpenAPI v9 (engineering.toggl.com) & Detailed report CSV (classic & Member)
 * - Clockify API v1 (docs.clockify.me) & Detailed report CSV
 * - Cross-way identity: export and API fetch produce the exact same externalId (SHA-256)
 */

const fixture = (name: string) =>
  new Uint8Array(readFileSync(resolve(import.meta.dirname, "fixtures", name)));

const togglAbzug = (von = "2026-09-01", bis = "2026-09-30") =>
  togglAbzugText({
    von,
    bis,
    user: [PETERSEN.toggl.me],
    client: PETERSEN.toggl.clients,
    project: PETERSEN.toggl.projects,
    task: PETERSEN.toggl.tasks,
    time_entry: PETERSEN.toggl.time_entries,
  });

const clockifyAbzug = (von = "2026-09-01", bis = "2026-09-30") =>
  clockifyAbzugText({
    von,
    bis,
    user: [PETERSEN.clockify.user],
    client: PETERSEN.clockify.clients,
    project: PETERSEN.clockify.projects,
    task: Object.values(PETERSEN.clockify.tasks).flat(),
    time_entry: PETERSEN.clockify.timeEntries,
  });

describe("zeiterfasser: Toggl Track and Clockify", () => {
  it("registers both tools in QUELLEN with file and API paths", () => {
    const toggl = quelleVon("toggl");
    const clockify = quelleVon("clockify");
    expect(toggl?.wege).toEqual(["datei", "api"]);
    expect(clockify?.wege).toEqual(["datei", "api"]);
  });

  it("reads Toggl classic CSV, Toggl Member CSV and Clockify CSV into the exact same bookings", () => {
    const tKlassisch = togglLesen(fixture("toggl-detailed.csv"));
    const tMitglied = togglLesen(fixture("toggl-detailed-member.csv"));
    const cCsv = clockifyLesen(fixture("clockify-detailed.csv"));

    expect(tKlassisch.fehler).toEqual([]);
    expect(tMitglied.fehler).toEqual([]);
    expect(cCsv.fehler).toEqual([]);

    expect(tKlassisch.daten.buchungen).toHaveLength(5);
    expect(tMitglied.daten.buchungen).toEqual(tKlassisch.daten.buchungen);
    expect(cCsv.daten.buchungen).toEqual(tKlassisch.daten.buchungen);
    expect(tKlassisch.daten.zeiten).toEqual([]);
  });

  it("produces the exact same booking externalIds from API fetches and CSV exports", () => {
    const csv = togglLesen(fixture("toggl-detailed.csv"));
    const tApi = togglLesen(utf8ToBytes(togglAbzug()));
    const cApi = clockifyLesen(utf8ToBytes(clockifyAbzug()));

    expect(tApi.fehler).toEqual([{ zeile: 19, grund: "laeuft_noch", feld: "ende" }]);
    // Clockify BREAK entry is skipped silently; running entry 6 is laeuft_noch
    expect(cApi.fehler).toEqual([{ zeile: 16, grund: "laeuft_noch", feld: "ende" }]);

    const ohneZeile = (b: typeof csv.daten.buchungen) => b.map(({ zeile: _, ...rest }) => rest);
    expect(ohneZeile(tApi.daten.buchungen)).toEqual(ohneZeile(csv.daten.buchungen));
    expect(ohneZeile(cApi.daten.buchungen)).toEqual(ohneZeile(csv.daten.buchungen));
  });

  it("strips e-mail, description, tags and rates from fetch files and hashes deterministically", () => {
    const t1 = togglAbzug();
    const t2 = togglAbzugText({
      von: "2026-09-01",
      bis: "2026-09-30",
      user: [PETERSEN.toggl.me],
      client: [...PETERSEN.toggl.clients].reverse(),
      project: [...PETERSEN.toggl.projects].reverse(),
      task: [...PETERSEN.toggl.tasks].reverse(),
      time_entry: [...PETERSEN.toggl.time_entries].reverse(),
    });
    expect(bytesToHex(sha256(utf8ToBytes(t1)))).toBe(bytesToHex(sha256(utf8ToBytes(t2))));
    expect(t1).not.toContain("lina@petersen-design.test");
    expect(t1).not.toContain("nicht-im-abzug");
    expect(t1).not.toContain("Erste Skizzen");
    expect(t1).not.toContain("Design");

    const c1 = clockifyAbzug();
    const c2 = clockifyAbzugText({
      von: "2026-09-01",
      bis: "2026-09-30",
      user: [PETERSEN.clockify.user],
      client: [...PETERSEN.clockify.clients].reverse(),
      project: [...PETERSEN.clockify.projects].reverse(),
      task: Object.values(PETERSEN.clockify.tasks).flat().reverse(),
      time_entry: [...PETERSEN.clockify.timeEntries].reverse(),
    });
    expect(bytesToHex(sha256(utf8ToBytes(c1)))).toBe(bytesToHex(sha256(utf8ToBytes(c2))));
    expect(c1).not.toContain("lina@petersen-design.test");
    expect(c1).not.toContain("Erste Skizzen");
    expect(c1).not.toContain("hourlyRate");
  });

  it("supports BOM, semicolons, 12h AM/PM and German dates, and rejects slash dates", () => {
    const csv = [
      "\uFEFFUser;Client;Project;Task;Start date;Start time;End date;End time",
      "Lina Petersen;Café Elbblick;Speisekarte;Entwurf;01.09.2026;09:00 AM;01.09.2026;11:30 AM",
      "Lina Petersen;Café Elbblick;Speisekarte;Entwurf;09/01/2026;09:00;09/01/2026;11:30",
    ].join("\r\n");
    const gelesen = togglLesen(utf8ToBytes(csv));
    expect(gelesen.daten.buchungen).toHaveLength(1);
    expect(gelesen.fehler).toEqual([
      { zeile: 3, grund: "datum_ungueltig", feld: "Start date", wert: "09/01/2026" },
    ]);
  });

  it("rejects DST spring-forward gap and fall-back ambiguous times, and invalid durations", () => {
    const csv = [
      "User,Client,Project,Task,Start date,Start time,End date,End time",
      // 2026-03-29 02:30 does not exist in Europe/Berlin
      "Lina Petersen,,,,2026-03-29,02:30,2026-03-29,03:30",
      // 2026-10-25 02:30 happens twice in Europe/Berlin
      "Lina Petersen,,,,2026-10-25,02:30,2026-10-25,04:00",
      // under 1 minute after flooring to the minute
      "Lina Petersen,,,,2026-09-01,09:00:00,2026-09-01,09:00:45",
      // 24 hours or longer
      "Lina Petersen,,,,2026-09-01,09:00:00,2026-09-02,09:00:00",
    ].join("\n");
    const gelesen = clockifyLesen(utf8ToBytes(csv));
    expect(gelesen.daten.buchungen).toEqual([]);
    expect(gelesen.fehler.map((f) => [f.zeile, f.grund])).toEqual([
      [2, "zeit_ungueltig"],
      [3, "zeit_ungueltig"],
      [4, "dauer_ungueltig"],
      [5, "dauer_ungueltig"],
    ]);
  });
});
