import { describe, expect, it } from "vitest";
import weber from "./fixtures/weber-kimai.json" with { type: "json" };
import { kimaiAbzugText, kimaiLesen } from "./index.ts";

/*
 * The reader of a fetch from Kimai (BAULISTE.md S-705). The fixture holds the answers of Kimai's
 * API as its source defines them: github.com/kimai/kimai 2.73.0, tests/API/
 * APIControllerBaseTestCase.php (UserCollection, CustomerCollection, ProjectCollection,
 * ActivityCollection, TimesheetCollection) and config/packages/jms_serializer.yaml (instants as
 * `Y-m-d\TH:i:sO`).
 */

const abzug = (aenderung: Partial<Record<string, unknown[]>> = {}, von = "2026-09-01") => ({
  von,
  bis: "2026-10-31",
  user: weber.users,
  customer: weber.customers,
  project: weber.projects,
  activity: weber.activities,
  timesheet: weber.timesheets,
  ...aenderung,
});

const lesen = (text: string) => kimaiLesen(new TextEncoder().encode(text));
const ausAbzug = (aenderung: Partial<Record<string, unknown[]>> = {}) =>
  lesen(kimaiAbzugText(abzug(aenderung)));
const zeit = (id: number, begin: string, end: string | null, extra: object = {}) => ({
  id,
  begin,
  end,
  user: 2,
  project: 1,
  activity: 1,
  break: 0,
  ...extra,
});

describe("kimaiAbzugText", () => {
  it("keeps only the fields Soll reads: no description, rate, tags, e-mail or comment", () => {
    const text = kimaiAbzugText(abzug());
    for (const verboten of ["Vorwand", "rate", "Baustelle", "@weber", "Herr Elbe", "040"])
      expect(text).not.toContain(verboten);
    expect(text.split("\n")[0]).toBe(
      '{"format":"soll-kimai-api","version":1,"von":"2026-09-01","bis":"2026-10-31"}',
    );
  });

  it("gives the same file for the same data in any order", () => {
    const umgedreht = abzug({
      timesheet: [...weber.timesheets].reverse(),
      user: [...weber.users].reverse(),
    });
    expect(kimaiAbzugText(umgedreht)).toBe(kimaiAbzugText(abzug()));
  });
});

describe("kimaiLesen with Weber's Kimai", () => {
  const gelesen = ausAbzug();

  it("reads customers, projects and activities with Kimai's ids, hidden ones too", () => {
    expect(gelesen.daten.kunden).toEqual([
      { externalId: "1", zeile: 5, name: "Elbhof Immobilien", nummer: "K-1001" },
      { externalId: "2", zeile: 6, name: "Bäckerei Schulz", nummer: "" },
    ]);
    expect(gelesen.daten.projekte.map((p) => [p.externalId, p.name, p.nummer, p.kunde])).toEqual([
      ["1", "Bad Elbhof", "A-17", "1"],
      ["2", "Backstube Heizung", "", "2"],
    ]);
    expect(gelesen.daten.taetigkeiten.map((t) => [t.externalId, t.name])).toEqual([
      ["1", "Montage"],
      ["2", "Rohinstallation"],
    ]);
  });

  it("puts a break in the middle of its timesheet: two spans, two bookings", () => {
    const sandra = gelesen.daten.zeiten.filter((z) => z.person === "Sandra Kühn");
    expect(sandra.filter((z) => z.tag === "2026-09-01")).toEqual([
      expect.objectContaining({ externalId: "10", beginn: 7 * 60, ende: 11 * 60, pauseMinuten: 0 }),
      expect.objectContaining({ externalId: "10-2", beginn: 11 * 60 + 30, ende: 15 * 60 + 30 }),
    ]);
    const buchungen = gelesen.daten.buchungen.filter((b) => b.externalId.startsWith("10/"));
    expect(buchungen.map((b) => [b.externalId, b.ende - b.beginn])).toEqual([
      ["10/1", 4 * 3_600_000],
      ["10/2", 4 * 3_600_000],
    ]);
  });

  it("makes one span of timesheets that touch, with a booking for each", () => {
    expect(gelesen.daten.zeiten.filter((z) => z.tag === "2026-09-02")).toEqual([
      expect.objectContaining({ externalId: "11", beginn: 7 * 60, ende: 15 * 60 }),
    ]);
    const buchungen = gelesen.daten.buchungen.filter((b) => b.tag === "2026-09-02");
    // each names the span it lies in, so a span not taken over takes both with it (review 2)
    expect(buchungen.map((b) => [b.externalId, b.projekt, b.taetigkeit, b.zeit])).toEqual([
      ["11/1", "1", "2", "11"],
      ["12/1", "1", "1", "11"],
    ]);
  });

  it("rounds begin down and end up to the minute, never to the person's disadvantage", () => {
    expect(gelesen.daten.zeiten.find((z) => z.externalId === "13")).toMatchObject({
      person: "Max Brandt",
      tag: "2026-10-01",
      beginn: 7 * 60,
      ende: 12 * 60 + 1,
    });
  });

  it("refuses a running timesheet and the hour that comes twice, with their lines", () => {
    expect(gelesen.fehler).toEqual([
      { zeile: 15, grund: "laeuft_noch", feld: "end" },
      { zeile: 16, grund: "zeit_ungueltig", feld: "begin" },
    ]);
  });
});

describe("kimaiLesen, single rules", () => {
  it("takes offsets with and without a colon and Z, and refuses an instant without one", () => {
    const g = ausAbzug({
      timesheet: [
        zeit(1, "2026-09-07T07:00:00+02:00", "2026-09-07T08:00:00+02:00"),
        zeit(2, "2026-09-07T07:00:00Z", "2026-09-07T08:00:00Z"),
        zeit(3, "2026-09-08T07:00:00", "2026-09-08T08:00:00+0200"),
        zeit(4, "2026-02-30T07:00:00+0100", "2026-09-08T08:00:00+0200"),
      ],
    });
    expect(g.daten.zeiten.map((z) => [z.externalId, z.beginn])).toEqual([
      ["1", 7 * 60],
      ["2", 9 * 60],
    ]);
    expect(g.fehler.map((f) => [f.zeile, f.grund, f.feld])).toEqual([
      [13, "zeit_ungueltig", "begin"],
      [14, "zeit_ungueltig", "begin"],
    ]);
  });

  it("starts a booking where the one before ended when rounding made them overlap", () => {
    const g = ausAbzug({
      timesheet: [
        zeit(1, "2026-09-07T07:00:30+0200", "2026-09-07T08:00:20+0200"),
        zeit(2, "2026-09-07T08:00:20+0200", "2026-09-07T09:00:00+0200"),
      ],
    });
    const [erste, zweite] = g.daten.buchungen;
    expect(zweite?.beginn).toBe(erste?.ende);
    expect(g.daten.zeiten).toHaveLength(1);
  });

  it("refuses a break as long as its timesheet", () => {
    const g = ausAbzug({
      timesheet: [zeit(1, "2026-09-07T07:00:00+0200", "2026-09-07T08:00:00+0200", { break: 3600 })],
    });
    expect(g.fehler).toEqual([
      { zeile: 11, grund: "pause_ungueltig", feld: "break", wert: "3600" },
    ]);
  });

  it("names a booking's unknown project, but keeps the time", () => {
    const g = ausAbzug({
      timesheet: [zeit(1, "2026-09-07T07:00:00+0200", "2026-09-07T08:00:00+0200", { project: 9 })],
    });
    expect(g.daten.zeiten).toHaveLength(1);
    expect(g.daten.buchungen).toEqual([]);
    expect(g.fehler).toEqual([
      { zeile: 11, grund: "projekt_unbekannt", feld: "project", wert: "9" },
    ]);
  });

  it("refuses a second record of an id and a project of an unknown customer", () => {
    const g = ausAbzug({
      project: [...weber.projects, { id: 3, name: "Ohne Kunde", customer: 77 }],
      timesheet: [
        zeit(1, "2026-09-07T07:00:00+0200", "2026-09-07T08:00:00+0200"),
        zeit(1, "2026-09-08T07:00:00+0200", "2026-09-08T08:00:00+0200"),
      ],
    });
    expect(g.fehler.map((f) => f.grund)).toEqual(["kunde_unbekannt", "kennung_doppelt"]);
  });

  it("leaves out timesheets fetched only as the margin around the period", () => {
    const g = ausAbzug({
      timesheet: [zeit(1, "2026-08-31T23:30:00+0200", "2026-09-01T01:00:00+0200")],
    });
    expect(g.daten.zeiten).toEqual([]);
    expect(g.fehler).toEqual([]);
  });

  it("tells two users of the same name apart by their id", () => {
    const g = ausAbzug({
      user: [
        { id: 2, username: "sandra", alias: "Sandra" },
        { id: 5, username: "sandra2", alias: "Sandra" },
      ],
      timesheet: [zeit(1, "2026-09-07T07:00:00+0200", "2026-09-07T08:00:00+0200", { user: 5 })],
    });
    expect(g.daten.zeiten[0]?.person).toBe("Sandra (5)");
  });

  it("refuses any file that is not a fetch from Kimai at its first line", () => {
    expect(lesen("Typ;Kennung\nzeit;1").fehler).toEqual([{ zeile: 1, grund: "kein_kopf" }]);
  });
});
