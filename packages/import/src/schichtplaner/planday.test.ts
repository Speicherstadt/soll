import { describe, expect, it } from "vitest";
import elbblick from "./fixtures/planday.json" with { type: "json" };
import { schichtplanerAbzugText, schichtplanerLesen } from "./index.ts";
import { type PlandayAntworten, plandayAbzug } from "./planday.ts";

/*
 * Planday's answers through the file to the common model (BAULISTE.md S-706). The fixture follows
 * Planday's Open API as github.com/borgels/mcp-server-planday (src/planday/resources.ts, its schemas
 * after Planday's OpenAPI documents) describes it: local times without an offset, read in
 * Europe/Berlin.
 */

const zeitraum = { von: "2026-09-01", bis: "2026-10-31" };
const text = (aenderung: Partial<PlandayAntworten> = {}) =>
  schichtplanerAbzugText(plandayAbzug({ ...elbblick, ...aenderung }, zeitraum));
const lesen = (inhalt: string) => schichtplanerLesen("planday")(new TextEncoder().encode(inhalt));

describe("plandayAbzug", () => {
  it("keeps no e-mail, phone, salary id, comment or note", () => {
    const inhalt = text();
    for (const verboten of ["@elbblick", "040", "L-1", "Lieferung", "Inventur", "Ostsee", "Grippe"])
      expect(inhalt).not.toContain(verboten);
  });

  it("survives answers of any shape", () => {
    const kaputt = {
      employees: [null, 1],
      shifts: [{ manualBreaks: "x", startDateTime: {} }],
      punchClock: [{ id: "x", startDateTime: "2026-09-01T07:00", endDateTime: "2026-09-01T08:00" }],
      breaks: { x: [null, { startDateTime: 4 }] },
      absenceRequests: [{ status: "Approved", absencePeriod: 3 }],
    };
    expect(() => text(kaputt as unknown as Partial<PlandayAntworten>)).not.toThrow();
  });
});

describe("schichtplanerLesen with Café Elbblick's Planday", () => {
  const gelesen = lesen(text());

  it("reads punch clock records around their breaks, the breaks rounded inward", () => {
    expect(gelesen.daten.zeiten.map(({ zeile: _, ...z }) => z)).toEqual([
      {
        externalId: "5001",
        person: "Tom Becker",
        tag: "2026-09-01",
        beginn: 418,
        ende: 631,
        pauseMinuten: 0,
      },
      {
        externalId: "5001/2",
        person: "Tom Becker",
        tag: "2026-09-01",
        beginn: 660,
        ende: 902,
        pauseMinuten: 0,
      },
    ]);
  });

  it("refuses a running record and a time of the hour that comes twice, with their lines", () => {
    const zeilen = text().split("\n");
    const grund = (id: string) =>
      gelesen.fehler.find((f) => zeilen[f.zeile - 1]?.includes(`"id":"${id}"`))?.grund;
    expect(grund("5002")).toBe("laeuft_noch");
    expect(grund("5003")).toBe("zeit_ungueltig");
  });

  it("reads published shifts with their position and planned break; drafts not", () => {
    expect(gelesen.daten.schichten.map(({ zeile: _, ...s }) => s)).toEqual([
      {
        externalId: "3001",
        person: "Tom Becker",
        beginn: Date.parse("2026-09-01T05:00:00Z"),
        ende: Date.parse("2026-09-01T13:00:00Z"),
        pauseMinuten: 30,
        rolle: "Küche",
      },
      {
        externalId: "3002",
        person: "Lea Wolf",
        beginn: Date.parse("2026-10-24T20:00:00Z"),
        ende: Date.parse("2026-10-25T05:00:00Z"),
        pauseMinuten: 0,
        rolle: "Service",
      },
      {
        externalId: "3003",
        person: null,
        beginn: Date.parse("2026-09-06T08:00:00Z"),
        ende: Date.parse("2026-09-06T16:00:00Z"),
        pauseMinuten: 0,
        rolle: "Service",
      },
    ]);
  });

  it("reads approved absences by Planday's type; requests and hours with their line", () => {
    expect(gelesen.daten.abwesenheiten.map(({ zeile: _, ...a }) => a)).toEqual([
      {
        externalId: "4001",
        person: "Tom Becker",
        art: "Vacation",
        von: "2026-09-14",
        bis: "2026-09-18",
      },
      {
        externalId: "4002",
        person: "Lea Wolf",
        art: "Absence",
        von: "2026-09-21",
        bis: "2026-09-22",
      },
    ]);
    expect(gelesen.fehler.map((f) => f.grund).sort()).toEqual([
      "laeuft_noch",
      "nicht_genehmigt",
      "teil_tag",
      "zeit_ungueltig",
    ]);
  });
});
