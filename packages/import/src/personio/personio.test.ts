import { describe, expect, it } from "vitest";
import weber from "./fixtures/weber-personio.json" with { type: "json" };
import { personioAbzugText, personioLesen } from "./index.ts";

/*
 * The reader of a fetch from Personio's API v2 (BAULISTE.md S-704). The fixture holds the answers of
 * the API as its descriptions define them: persons after persons-service-api-v2 (developer.personio.de
 * /openapi, mirrored in github.com/Hochfrequenz/personio_client.py, openapi/v2), attendance and
 * absence periods and absence types after the v2 clients github.com/PK-Consulting/
 * n8n-nodes-personio-hr (descriptions/*Description.ts) and github.com/ninjaneers-team/pysonio
 * (models/absence_periods.py, absence_types.py): local date-times without an offset, `approval.status`,
 * half days as `starts_from.type` and `ends_at.type`.
 */

type Aenderung = Partial<
  Record<"person" | "absence_type" | "attendance" | "absence", unknown[]>
> & {
  von?: string;
  bis?: string;
};

const abzug = (aenderung: Aenderung = {}) => ({
  von: "2026-09-01",
  bis: "2026-09-30",
  person: weber.persons,
  absence_type: weber.absence_types,
  attendance: weber.attendance_periods,
  absence: weber.absence_periods,
  ...aenderung,
});

const lesen = (text: string) => personioLesen(new TextEncoder().encode(text));
const ausAbzug = (aenderung: Aenderung = {}) => lesen(personioAbzugText(abzug(aenderung)));
const id = (n: number) => `a1b2c3d4-0000-4000-8000-${String(n).padStart(12, "0")}`;

const periode = (
  n: number,
  typ: string,
  start: string,
  end: string | null,
  status = "CONFIRMED",
) => ({
  id: id(n),
  person: { id: "1002" },
  type: typ,
  start: { date_time: start },
  end: end === null ? null : { date_time: end },
  approval: { status },
});

describe("personioAbzugText", () => {
  it("keeps only the fields Soll reads: no e-mail, gender, custom attribute or comment", () => {
    const text = personioAbzugText(abzug());
    for (const verboten of ["@", "IBAN", "gender", "Rückenschmerzen", "Sommerurlaub", "Elbhof"])
      expect(text).not.toContain(verboten);
    expect(text.split("\n")[2]).toBe(
      '{"kind":"person","id":"1002","first_name":"Sandra","last_name":"Kühn","preferred_name":"Sandra Kühn"}',
    );
  });

  it("gives the same file for the same data in any order", () => {
    const umgedreht = abzug({
      person: [...weber.persons].reverse(),
      attendance: [...weber.attendance_periods].reverse(),
      absence: [...weber.absence_periods].reverse(),
    });
    expect(personioAbzugText(umgedreht)).toBe(personioAbzugText(abzug()));
  });
});

describe("personioLesen", () => {
  it("takes confirmed work without its breaks, outwards to the minute, as spans of work", () => {
    const { daten } = ausAbzug();
    expect(
      daten.zeiten.map(({ person, tag, beginn, ende, externalId }) => [
        person,
        tag,
        beginn,
        ende,
        externalId,
      ]),
    ).toEqual([
      ["Sandra Kühn", "2026-09-01", 420, 720, id(1)],
      ["Sandra Kühn", "2026-09-01", 750, 930, id(3)],
      // 07:00:20 to 15:30:10 with a break 11:00 to 11:30: begin down, end up
      ["Sandra Kühn", "2026-09-02", 420, 660, id(4)],
      ["Sandra Kühn", "2026-09-02", 690, 931, `${id(4)}-2`],
      // a night shift belongs to the day it starts
      ["Max Brandt", "2026-09-01", 1320, 360, id(8)],
    ]);
    expect(daten.zeiten.every((z) => z.pauseMinuten === 0)).toBe(true);
  });

  it("names a pending and an open period with their line and leaves a refused one out", () => {
    const { fehler } = ausAbzug();
    expect(fehler.filter((f) => f.zeile >= 9 && f.zeile <= 17)).toEqual([
      { zeile: 14, grund: "nicht_genehmigt", feld: "approval.status", wert: "PENDING" },
      { zeile: 17, grund: "laeuft_noch", feld: "end.date_time" },
    ]);
  });

  it("takes approved absences in whole and half days, by the name of their type", () => {
    const { daten } = ausAbzug();
    expect(daten.abwesenheiten).toEqual([
      {
        externalId: "e5f6a7b8-0000-4000-8000-000000000010",
        zeile: 18,
        person: "Sandra Kühn",
        art: "Urlaub",
        von: "2026-09-14",
        bis: "2026-09-18",
      },
      {
        externalId: "e5f6a7b8-0000-4000-8000-000000000011",
        zeile: 19,
        person: "Sandra Kühn",
        art: "Urlaub",
        von: "2026-09-21",
        bis: "2026-09-21",
        ersterHalb: true,
      },
      {
        externalId: "e5f6a7b8-0000-4000-8000-000000000012",
        zeile: 20,
        person: "Max Brandt",
        art: "Krankheit",
        von: "2026-09-08",
        bis: "2026-09-09",
        letzterHalb: true,
      },
    ]);
  });

  it("names a pending absence, one in hours and an open one with their line", () => {
    const { fehler } = ausAbzug();
    expect(fehler.filter((f) => f.zeile >= 18)).toEqual([
      { zeile: 21, grund: "nicht_genehmigt", feld: "approval.status", wert: "PENDING" },
      { zeile: 22, grund: "teil_tag", feld: "absence_type.id", wert: "Freizeitausgleich" },
      { zeile: 23, grund: "laeuft_noch", feld: "ends_at.date_time" },
    ]);
  });

  it("names Personio's persons by first and last name for the mapping", () => {
    const zwei = [
      { id: "7", first_name: "Anna", last_name: "Peters" },
      { id: "8", first_name: "Anna", last_name: "Peters" },
      { id: "9", first_name: null, last_name: null, preferred_name: "Olena" },
    ];
    const { daten } = ausAbzug({
      person: zwei,
      attendance: ["7", "8", "9"].map((wer, i) => ({
        ...periode(i + 1, "WORK", `2026-09-0${i + 1}T08:00:00`, `2026-09-0${i + 1}T09:00:00`),
        person: { id: wer },
      })),
    });
    expect(daten.zeiten.map((z) => z.person)).toEqual([
      "Anna Peters (7)",
      "Anna Peters (8)",
      "Olena",
    ]);
  });

  it("takes out breaks that overlap each other or the edge of the work", () => {
    const { daten } = ausAbzug({
      attendance: [
        periode(1, "WORK", "2026-09-01T07:00:00", "2026-09-01T16:00:00"),
        periode(2, "BREAK", "2026-09-01T06:30:00", "2026-09-01T07:15:00"),
        periode(3, "BREAK", "2026-09-01T12:00:00", "2026-09-01T12:45:00"),
        periode(4, "BREAK", "2026-09-01T11:50:00", "2026-09-01T12:20:00"),
        // inwards: 13:59:30 to 14:00:20 is less than a minute and takes nothing
        periode(5, "BREAK", "2026-09-01T13:59:30", "2026-09-01T14:00:20"),
      ],
    });
    expect(daten.zeiten.map((z) => [z.beginn, z.ende, z.externalId])).toEqual([
      [435, 710, id(1)],
      [765, 960, `${id(1)}-2`],
    ]);
  });

  it("refuses a time the change of the clocks skips or repeats", () => {
    const { daten, fehler } = ausAbzug({
      von: "2026-01-01",
      bis: "2026-12-31",
      absence: [],
      attendance: [
        periode(1, "WORK", "2026-03-29T01:00:00", "2026-03-29T02:30:00"),
        periode(2, "WORK", "2026-10-25T02:30:00", "2026-10-25T05:00:00"),
        periode(3, "WORK", "2026-10-24T22:00:00", "2026-10-25T06:00:00"),
      ],
    });
    expect(fehler).toEqual([
      { zeile: 9, grund: "zeit_ungueltig", feld: "end.date_time" },
      { zeile: 10, grund: "zeit_ungueltig", feld: "start.date_time" },
    ]);
    // a night across the change of the clocks keeps its nine real hours
    expect(daten.zeiten.map((z) => [z.tag, z.beginn, z.ende])).toEqual([["2026-10-24", 1320, 360]]);
  });

  it("reads only the periods that begin in the period of the head", () => {
    const { daten } = ausAbzug({
      attendance: [
        periode(1, "WORK", "2026-08-31T22:00:00", "2026-09-01T02:00:00"),
        periode(2, "WORK", "2026-09-30T22:00:00", "2026-10-01T02:00:00"),
        periode(3, "WORK", "2026-10-01T08:00:00", "2026-10-01T09:00:00"),
      ],
    });
    expect(daten.zeiten.map((z) => z.externalId)).toEqual([id(2)]);
  });

  it("refuses half days that leave no time and a type the file does not hold", () => {
    const ab = (n: number, extra: object) => ({
      id: `b-${n}`,
      person: { id: "1002" },
      absence_type: { id: weber.absence_types[0]?.id },
      starts_from: { date_time: "2026-09-21T00:00:00", type: "SECOND_HALF" },
      ends_at: { date_time: "2026-09-21T23:59:59", type: "FIRST_HALF" },
      approval: { status: "APPROVED" },
      ...extra,
    });
    const { daten, fehler } = ausAbzug({
      attendance: [],
      absence: [
        ab(1, {}),
        ab(2, { absence_type: { id: "unbekannt" } }),
        ab(3, { ends_at: { date_time: "2026-09-22T23:59:59", type: "SECOND_HALF" } }),
        ab(4, { ends_at: { date_time: "2026-09-20T00:00:00" } }),
        ab(5, { approval: { status: "REJECTED" } }),
        ab(6, { approval: null, ends_at: { date_time: "2026-09-21T00:00:00", type: null } }),
      ],
    });
    expect(fehler).toEqual([
      { zeile: 9, grund: "datum_ungueltig", feld: "ends_at.type" },
      { zeile: 10, grund: "art_fehlt", feld: "absence_type.id", wert: "unbekannt" },
      { zeile: 12, grund: "datum_ungueltig", feld: "ends_at.date_time", wert: "2026-09-20" },
    ]);
    // the day's last second ends a whole day; without an approval workflow an absence stands
    expect(daten.abwesenheiten.map((a) => [a.externalId, a.von, a.bis, a.ersterHalb])).toEqual([
      ["b-3", "2026-09-21", "2026-09-22", true],
      ["b-6", "2026-09-21", "2026-09-21", true],
    ]);
  });

  it("refuses records of the wrong shape and a second record of an id with their line", () => {
    const text = personioAbzugText(abzug({ attendance: [], absence: [] }));
    const zeilen = [
      '{"kind":"attendance","id":"x","person.id":"1002","type":"SLEEP","start.date_time":"2026-09-01T07:00:00"}',
      '{"kind":"attendance","id":"y","person.id":"1002","type":"WORK","start.date_time":"2026-09-01T07:00:00+02:00"}',
      '{"kind":"person","id":"1002","first_name":"Sandra","last_name":"Kühn"}',
      '{"kind":"payroll","id":"1"}',
      "kein JSON",
    ];
    expect(lesen(`${text}${zeilen.join("\n")}\n`).fehler).toEqual([
      { zeile: 9, grund: "typ_unbekannt", feld: "type" },
      { zeile: 10, grund: "zeit_ungueltig", feld: "start.date_time" },
      { zeile: 11, grund: "kennung_doppelt", feld: "id", wert: "1002" },
      { zeile: 12, grund: "typ_unbekannt", feld: "kind" },
      { zeile: 13, grund: "unlesbar" },
    ]);
  });

  it("refuses a file that is no fetch from Personio at its first line", () => {
    expect(lesen('{"format":"soll-kimai-api","version":1}\n').fehler).toEqual([
      { zeile: 1, grund: "kein_kopf" },
    ]);
  });
});
