import { describe, expect, it } from "vitest";
import elbblick from "./fixtures/papershift.json" with { type: "json" };
import { schichtplanerAbzugText, schichtplanerLesen } from "./index.ts";
import { type PapershiftAntworten, papershiftAbzug } from "./papershift.ts";

/*
 * Papershift's answers through the file to the common model (BAULISTE.md S-706). The fixture
 * follows Papershift's public API v1 as Papershift's own github.com/Papershift/hosted_pages_template
 * (working sessions), github.com/maluramichael/papershift-cli (`user_id`, `breaks`),
 * github.com/bestit/bamboohr-connector (absences until "T24:00", `full_day`) and the excerpts of
 * developers.papershift.com (`confirmed_at`, `break_duration` in seconds) describe it.
 */

const zeitraum = { von: "2026-09-01", bis: "2026-09-30" };
const text = (aenderung: Partial<PapershiftAntworten> = {}) =>
  schichtplanerAbzugText(papershiftAbzug({ ...elbblick, ...aenderung }, zeitraum));
const lesen = (inhalt: string) =>
  schichtplanerLesen("papershift")(new TextEncoder().encode(inhalt));

describe("papershiftAbzug", () => {
  it("keeps no e-mail, note or staff number", () => {
    const inhalt = text();
    for (const verboten of ["@elbblick", "Inventur", "Grippe", "staff_number", "working_area"])
      expect(inhalt).not.toContain(verboten);
  });

  it("splits a session around its breaks as stamped", () => {
    const saetze = text()
      .split("\n")
      .filter((zeile) => zeile.includes('"kind":"work"'));
    expect(saetze).toContain(
      '{"kind":"work","id":"51001","person":"301","begin":"2026-09-01T04:58:30Z","end":"2026-09-01T08:30:00Z"}',
    );
    expect(saetze).toContain(
      '{"kind":"work","id":"51001/2","person":"301","begin":"2026-09-01T09:00:00Z","end":"2026-09-01T13:01:10Z"}',
    );
  });

  it("survives answers of any shape", () => {
    const kaputt = {
      users: [null, 3, {}],
      workingSessions: [{ starts_at: 1, breaks: [null, { starts_at: "x" }] }, { breaks: "x" }],
      absences: [{ ends_at: {} }],
    };
    expect(() => text(kaputt as Partial<PapershiftAntworten>)).not.toThrow();
  });
});

describe("schichtplanerLesen with Café Elbblick's Papershift", () => {
  const gelesen = lesen(text());

  it("reads the sessions as spans; a break known only by its length lies in the middle", () => {
    expect(gelesen.daten.zeiten.map(({ zeile: _, ...z }) => z)).toEqual([
      {
        externalId: "51001",
        person: "Tom Becker",
        tag: "2026-09-01",
        beginn: 418,
        ende: 630,
        pauseMinuten: 0,
      },
      {
        externalId: "51001/2",
        person: "Tom Becker",
        tag: "2026-09-01",
        beginn: 660,
        ende: 902,
        pauseMinuten: 0,
      },
      {
        externalId: "51002",
        person: "Lea Wolf",
        tag: "2026-09-02",
        beginn: 720,
        ende: 945,
        pauseMinuten: 0,
      },
      {
        externalId: "51002/2",
        person: "Lea Wolf",
        tag: "2026-09-02",
        beginn: 975,
        ende: 1200,
        pauseMinuten: 0,
      },
    ]);
  });

  it("reads confirmed whole-day absences; open and part-day ones with their line", () => {
    expect(gelesen.daten.abwesenheiten.map(({ zeile: _, ...a }) => a)).toEqual([
      {
        externalId: "7001",
        person: "Tom Becker",
        art: "Urlaub",
        von: "2026-09-14",
        bis: "2026-09-18",
      },
      {
        externalId: "7002",
        person: "Lea Wolf",
        art: "Krank",
        von: "2026-09-21",
        bis: "2026-09-22",
      },
    ]);
    expect(gelesen.fehler.map((f) => f.grund).sort()).toEqual([
      "laeuft_noch",
      "nicht_genehmigt",
      "teil_tag",
    ]);
  });

  it("has no shifts: who is planned on Papershift's shifts no source names", () => {
    expect(gelesen.daten.schichten).toEqual([]);
  });
});
