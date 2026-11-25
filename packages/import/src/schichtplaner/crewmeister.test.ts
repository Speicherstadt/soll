import { describe, expect, it } from "vitest";
import { type CrewmeisterAntworten, crewmeisterAbzug } from "./crewmeister.ts";
import elbblick from "./fixtures/crewmeister.json" with { type: "json" };
import { schichtplanerAbzugText, schichtplanerLesen } from "./index.ts";

/*
 * Crewmeister's answers through the file to the common model (BAULISTE.md S-706). The fixture
 * follows Crewmeister's API v3 as github.com/mztechnik/hacs-crewmeister (api/models.py: stamps and
 * absences) and github.com/HelpCode-ai/anythingmcp (adapters/de/crewmeister.json: members, absence
 * types, shifts, workplaces, states, day parts) describe it.
 */

const zeitraum = { von: "2026-09-01", bis: "2026-09-30" };
const antworten = (aenderung: Partial<CrewmeisterAntworten> = {}): CrewmeisterAntworten => ({
  ...elbblick,
  ...aenderung,
});
const text = (aenderung: Partial<CrewmeisterAntworten> = {}) =>
  schichtplanerAbzugText(crewmeisterAbzug(antworten(aenderung), zeitraum));
const lesen = (inhalt: string) =>
  schichtplanerLesen("crewmeister")(new TextEncoder().encode(inhalt));

describe("crewmeisterAbzug", () => {
  it("keeps no e-mail, note, location or employee number", () => {
    const inhalt = text();
    for (const verboten of ["@elbblick", "Grippe", "Lieferung", "Elbchaussee", "E-1"])
      expect(inhalt).not.toContain(verboten);
    expect(inhalt.split("\n")[0]).toBe(
      '{"format":"soll-schichtplaner-api","version":1,"tool":"crewmeister","from":"2026-09-01","to":"2026-09-30"}',
    );
  });

  it("gives the same file for the same answers in any order", () => {
    const umgedreht = text({
      stamps: [...elbblick.stamps].reverse(),
      members: [...elbblick.members].reverse(),
      shifts: [...elbblick.shifts].reverse(),
    });
    expect(umgedreht).toBe(text());
  });

  it("survives answers of any shape", () => {
    const kaputt = { members: [1, null, "x", [], {}], stamps: [{ timestamp: {} }], shifts: [null] };
    expect(() => text(kaputt as Partial<CrewmeisterAntworten>)).not.toThrow();
  });
});

describe("schichtplanerLesen with Café Elbblick's Crewmeister", () => {
  const gelesen = lesen(text());

  it("reads the stamp chains as spans; the break between them stays a gap, rounded for the person", () => {
    expect(gelesen.daten.zeiten.map(({ zeile: _, ...z }) => z)).toEqual([
      {
        externalId: "9001",
        person: "Tom Becker",
        tag: "2026-09-01",
        beginn: 418,
        ende: 630,
        pauseMinuten: 0,
      },
      {
        externalId: "9003",
        person: "Tom Becker",
        tag: "2026-09-01",
        beginn: 660,
        ende: 902,
        pauseMinuten: 0,
      },
      {
        externalId: "9010",
        person: "Lea Wolf",
        tag: "2026-09-04",
        beginn: 1075,
        ende: 1320,
        pauseMinuten: 0,
      },
      {
        externalId: "9012",
        person: "Lea Wolf",
        tag: "2026-09-04",
        beginn: 1350,
        ende: 125,
        pauseMinuten: 0,
      },
    ]);
  });

  it("refuses a chain still open with its line and ignores an invalid stamp", () => {
    expect(gelesen.fehler.map((f) => f.grund)).toEqual(["laeuft_noch", "nicht_genehmigt"]);
    expect(gelesen.daten.zeiten.some((z) => z.externalId === "9014")).toBe(false);
  });

  it("reads the published shifts with their workplace; an open one has no person", () => {
    expect(gelesen.daten.schichten.map(({ zeile: _, ...s }) => s)).toEqual([
      {
        externalId: "8001",
        person: "Tom Becker",
        beginn: Date.parse("2026-09-01T05:00:00Z"),
        ende: Date.parse("2026-09-01T13:00:00Z"),
        pauseMinuten: 0,
        rolle: "Küche",
      },
      {
        externalId: "8002",
        person: "Lea Wolf",
        beginn: Date.parse("2026-09-04T16:00:00Z"),
        ende: Date.parse("2026-09-05T00:00:00Z"),
        pauseMinuten: 0,
        rolle: "Service",
      },
      {
        externalId: "8003",
        person: null,
        beginn: Date.parse("2026-09-06T08:00:00Z"),
        ende: Date.parse("2026-09-06T16:00:00Z"),
        pauseMinuten: 0,
        rolle: "Service",
      },
    ]);
  });

  it("reads approved absences with their kind and half days; a request with its line", () => {
    expect(gelesen.daten.abwesenheiten.map(({ zeile: _, ...a }) => a)).toEqual([
      {
        externalId: "6001",
        person: "Tom Becker",
        art: "Urlaub",
        von: "2026-09-14",
        bis: "2026-09-18",
      },
      {
        externalId: "6002",
        person: "Lea Wolf",
        art: "Krankheit",
        von: "2026-09-21",
        bis: "2026-09-22",
      },
      {
        externalId: "6003",
        person: "Yusuf Demir",
        art: "Urlaub",
        von: "2026-09-25",
        bis: "2026-09-25",
        ersterHalb: true,
      },
    ]);
    const offen = gelesen.fehler.find((f) => f.grund === "nicht_genehmigt");
    expect(text().split("\n")[(offen?.zeile ?? 0) - 1]).toContain('"id":"6004"');
  });

  it("refuses an afternoon to the morning of the same day", () => {
    const absences = [{ ...elbblick.absences[2], fromDayPart: "AFTERNOON", toDayPart: "MORNING" }];
    expect(lesen(text({ absences })).fehler.map((f) => f.grund)).toContain("datum_ungueltig");
  });

  it("is a file of Crewmeister only", () => {
    expect(schichtplanerLesen("planday")(new TextEncoder().encode(text())).fehler).toEqual([
      { zeile: 1, grund: "kein_kopf" },
    ]);
  });
});
