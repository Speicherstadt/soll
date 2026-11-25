import { describe, expect, it } from "vitest";
import { vorschlag } from "../zuordnung.ts";
import { type Abzug, abzugText, clockodoLesen } from "./index.ts";

/*
 * The file of a fetch from Clockodo's API (S-703). The records follow the models of the public SDK,
 * in the snake_case the API sends (src/lib/mappings.ts maps them): User, Customer, Project, Service
 * (https://github.com/peerigon/clockodo/tree/main/src/models), Entry (entry.ts) and Absence
 * (absence.ts, with AbsenceType and AbsenceStatus).
 */

const ABZUG: Abzug = {
  von: "2026-09-01",
  bis: "2026-09-30",
  user: [
    { id: 12, name: "Max Brandt", email: "max@weber-haustechnik.test", role: "worker" },
    { id: 11, name: "Sandra Kühn", number: "P-7", email: "sandra@weber-haustechnik.test" },
  ],
  customer: [{ id: 201, name: "Elbhof Immobilien", number: "K-1001", note: "Tor 3", active: true }],
  project: [{ id: 301, customers_id: 201, name: "Bad Elbhof", number: "A-17", revenue_factor: 1 }],
  service: [{ id: 401, name: "Montage", number: null, note: null }],
  entry: [
    {
      id: 1002,
      users_id: 11,
      customers_id: 201,
      projects_id: 301,
      services_id: 401,
      type: 1,
      time_since: "2026-09-01T09:00:00Z",
      time_until: "2026-09-01T13:30:00Z",
      hourly_rate: 60,
      text: "Rohre verlegt",
    },
    {
      id: 1001,
      users_id: 11,
      type: 1,
      time_since: "2026-09-01T05:00:00Z",
      time_until: "2026-09-01T09:00:00Z",
    },
  ],
  absence: [
    {
      id: 501,
      users_id: 12,
      date_since: "2026-09-07",
      date_until: "2026-09-11",
      status: 1,
      type: 1,
      count_days: 5,
      count_hours: null,
      note: "Ostsee",
    },
    {
      id: 502,
      users_id: 11,
      date_since: "2026-09-14",
      date_until: "2026-09-14",
      status: 1,
      type: 4,
      count_days: 1,
      count_hours: null,
      sick_note: true,
      note: "Diagnose steht hier nicht",
    },
    {
      id: 503,
      users_id: 11,
      date_since: "2026-09-21",
      date_until: "2026-09-21",
      status: 0,
      type: 1,
      count_days: 1,
    },
    {
      id: 504,
      users_id: 11,
      date_since: "2026-09-22",
      date_until: "2026-09-22",
      status: 1,
      type: 1,
      count_days: 0.5,
    },
    {
      id: 505,
      users_id: 12,
      date_since: "2026-09-23",
      date_until: "2026-09-23",
      status: 1,
      type: 3,
      count_days: null,
      count_hours: 3,
    },
    {
      id: 506,
      users_id: 12,
      date_since: "2026-09-24",
      date_until: "2026-09-24",
      status: 2,
      type: 1,
      count_days: 1,
    },
  ],
};

describe("the file of a fetch from Clockodo's API", () => {
  const text = abzugText(ABZUG);

  it("keeps only the fields Soll reads: no note, sick note, e-mail, rate or text", () => {
    for (const verboten of [
      "note",
      "sick_note",
      "email",
      "hourly_rate",
      "Rohre",
      "Ostsee",
      "Diagnose",
      "revenue",
    ])
      expect(text).not.toContain(verboten);
    expect(text.split("\n")[0]).toBe(
      '{"format":"soll-clockodo-api","version":1,"von":"2026-09-01","bis":"2026-09-30"}',
    );
  });

  it("is the same text for the same records in any order", () => {
    const umgedreht = Object.fromEntries(
      Object.entries(ABZUG).map(([k, v]) => [k, Array.isArray(v) ? [...v].reverse() : v]),
    ) as Abzug;
    expect(abzugText(umgedreht)).toBe(text);
  });

  it("reads times, approved whole-day absences, customers, projects and services", () => {
    const { daten, fehler } = clockodoLesen(text);
    expect(daten.zeiten).toEqual([
      expect.objectContaining({
        externalId: "1001",
        person: "Sandra Kühn",
        beginn: 420,
        ende: 930,
      }),
    ]);
    expect(daten.abwesenheiten).toEqual([
      expect.objectContaining({ externalId: "501", person: "Max Brandt", art: "Regular holiday" }),
      expect.objectContaining({ externalId: "502", person: "Sandra Kühn", art: "Sick day" }),
    ]);
    expect(daten.kunden).toEqual([
      expect.objectContaining({ externalId: "201", name: "Elbhof Immobilien", nummer: "K-1001" }),
    ]);
    expect(daten.projekte).toEqual([
      expect.objectContaining({ externalId: "301", kunde: "201", nummer: "A-17" }),
    ]);
    expect(daten.taetigkeiten).toEqual([
      expect.objectContaining({ externalId: "401", name: "Montage" }),
    ]);
    // a request waiting, half a day, hours of overtime reduction: named by line; declined: never was
    expect(fehler.map((f) => [f.grund, f.feld])).toEqual([
      ["nicht_genehmigt", "status"],
      ["teil_tag", "count_days"],
      ["teil_tag", "count_hours"],
    ]);
  });

  it("proposes leave and sickness for Clockodo's types", () => {
    const z = vorschlag(clockodoLesen(text).daten, []);
    expect(z.arten).toEqual({ "Regular holiday": "urlaub", "Sick day": "krank" });
  });

  it("names users of the same name by their id", () => {
    const zwei = abzugText({
      ...ABZUG,
      user: [
        { id: 11, name: "Sandra Kühn" },
        { id: 12, name: "Sandra Kühn" },
      ],
    });
    const personen = clockodoLesen(zwei).daten.zeiten.map((z) => z.person);
    expect(personen).toEqual(["Sandra Kühn (11)"]);
  });

  it("refuses lines of a wrong shape with their line and reads the rest", () => {
    const kaputt = [
      text.split("\n")[0],
      "kein json",
      "[1,2]",
      '{"kind":"rocket","id":1}',
      '{"kind":"entry","id":"x"}',
      '{"kind":"entry","id":7,"users_id":11,"type":1,"time_since":"2026-09-02T05:00:00Z","time_until":5}',
      '{"kind":"user","id":11,"name":""}',
      '{"kind":"entry","id":8,"users_id":11,"type":1,"time_since":"2026-09-03T05:00:00Z","time_until":"2026-09-03T06:00:00Z"}',
    ].join("\n");
    const gelesen = clockodoLesen(kaputt);
    expect(gelesen.fehler.map((f) => [f.zeile, f.grund])).toEqual([
      [2, "unlesbar"],
      [3, "unlesbar"],
      [4, "typ_unbekannt"],
      [5, "kennung_fehlt"],
      [6, "zeit_ungueltig"],
      [7, "name_fehlt"],
    ]);
    expect(gelesen.daten.zeiten.map((z) => [z.externalId, z.zeile, z.person])).toEqual([
      ["8", 8, "#11"],
    ]);
  });

  it("refuses a head of another format or version", () => {
    expect(clockodoLesen('{"format":"soll-clockodo-api","version":2}\n').fehler).toEqual([
      { zeile: 1, grund: "kein_kopf" },
    ]);
  });
});
