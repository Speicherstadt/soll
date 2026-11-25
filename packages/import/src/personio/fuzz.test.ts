import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_DATENSAETZE } from "../modell.ts";
import { inZeit } from "../zeit-testhilfen.ts";
import { PERSONIO_FORMAT, personioAbzugText, personioLesen } from "./index.ts";
import { ortszeitLesen, tagVon } from "./werte.ts";

/*
 * Fuzzing of Personio's reader (BAULISTE.md S-704): no file makes it throw or take longer than 1 s
 * (docs/plan.md, "Zeitgrenze der Leser in den Tests"), and every error names a line of the file.
 */

const KOPF = JSON.stringify({
  format: PERSONIO_FORMAT,
  version: 1,
  von: "2026-01-01",
  bis: "2026-12-31",
});

const lesen = (text: string) => personioLesen(new TextEncoder().encode(text));

const ortszeit = fc.oneof(
  fc
    .date({ min: new Date("1990-01-01"), max: new Date("2110-01-01"), noInvalidDate: true })
    .map((d) => d.toISOString().slice(0, 19)),
  fc.string(),
  fc.constantFrom("2026-10-25T02:30:00", "2026-03-29T02:30:00", "2026-09-01T23:59:59.999"),
  fc.constant(null),
);

const wert = fc.oneof(fc.string(), fc.integer(), fc.double(), fc.boolean(), fc.constant(null));
const kennung = fc.oneof(
  fc.integer({ min: -2, max: 30 }).map(String),
  fc.uuid(),
  fc.string(),
  fc.constant(null),
);

const satz = fc.oneof(
  fc.record({ kind: fc.constant("person"), id: kennung, first_name: wert, last_name: wert }),
  fc.record({
    kind: fc.constant("absence_type"),
    id: kennung,
    name: wert,
    unit: fc.oneof(fc.constantFrom("DAY", "HOUR"), wert),
  }),
  fc.record({
    kind: fc.constant("attendance"),
    id: kennung,
    "person.id": kennung,
    type: fc.oneof(fc.constantFrom("WORK", "BREAK"), wert),
    "start.date_time": ortszeit,
    "end.date_time": ortszeit,
    "approval.status": fc.oneof(fc.constantFrom("CONFIRMED", "PENDING", "REJECTED"), wert),
  }),
  fc.record({
    kind: fc.constant("absence"),
    id: kennung,
    "person.id": kennung,
    "absence_type.id": kennung,
    "starts_from.date_time": ortszeit,
    "starts_from.type": fc.oneof(fc.constantFrom("FIRST_HALF", "SECOND_HALF"), wert),
    "ends_at.date_time": ortszeit,
    "ends_at.type": fc.oneof(fc.constantFrom("FIRST_HALF", "SECOND_HALF"), wert),
    "approval.status": fc.oneof(fc.constantFrom("APPROVED", "PENDING"), wert),
  }),
  fc.dictionary(fc.string(), wert),
);

const pruefen = (text: string) => {
  // within 1 s, or a multiple of a reference pass on a loaded machine (zeit-testhilfen.ts)
  const gelesen = inZeit(() => lesen(text));
  const zeilen = text.split("\n").length;
  for (const fehler of gelesen.fehler) {
    expect(fehler.zeile).toBeGreaterThanOrEqual(1);
    expect(fehler.zeile).toBeLessThanOrEqual(Math.max(zeilen, MAX_DATENSAETZE + 2));
  }
  for (const zeit of gelesen.daten.zeiten) {
    expect(Number.isInteger(zeit.beginn) && Number.isInteger(zeit.ende)).toBe(true);
    expect(zeit.beginn).not.toBe(zeit.ende);
  }
};

describe("personioLesen under fuzzing", () => {
  it("never throws on any text", () => {
    fc.assert(fc.property(fc.string({ maxLength: 2000 }), pruefen), { numRuns: 300 });
  });

  it("never throws on lines of valid and broken records", () => {
    fc.assert(
      fc.property(fc.array(satz, { maxLength: 60 }), (saetze) =>
        pruefen([KOPF, ...saetze.map((s) => JSON.stringify(s))].join("\n")),
      ),
      { numRuns: 300 },
    );
  });

  it("never throws on a fetch of records of any shape", () => {
    fc.assert(
      fc.property(fc.array(fc.anything(), { maxLength: 20 }), (liste) =>
        pruefen(
          personioAbzugText({
            von: "2026-01-01",
            bis: "2026-12-31",
            person: liste,
            absence_type: liste,
            attendance: liste,
            absence: liste,
          }),
        ),
      ),
      { numRuns: 200 },
    );
  });

  it("reads 20,000 periods within 1 s and refuses one more", () => {
    const lokal = (ms: number) => new Date(ms).toISOString().slice(0, 19);
    const zeilen = Array.from({ length: MAX_DATENSAETZE }, (_, i) => {
      const beginn = Date.UTC(2026, 0, 1) + i * 1_500_000;
      return JSON.stringify({
        kind: "attendance",
        id: `p-${i}`,
        "person.id": String((i % 7) + 1),
        type: i % 5 === 4 ? "BREAK" : "WORK",
        "start.date_time": lokal(beginn),
        "end.date_time": lokal(beginn + 1_200_000),
        "approval.status": "CONFIRMED",
      });
    });
    pruefen([KOPF, ...zeilen].join("\n"));
    expect(lesen([KOPF, ...zeilen, zeilen[0]].join("\n")).fehler).toEqual([
      { zeile: MAX_DATENSAETZE + 2, grund: "zu_viele" },
    ]);
  });

  it("refuses a line of deeply nested brackets at once", () => {
    pruefen(`${KOPF}\n{"kind":"person","id":${"[".repeat(1_000_000)}`);
  });

  it("reads a local date-time back to its day", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2099-12-31"), noInvalidDate: true }),
        (datum) => {
          const text = datum.toISOString().slice(0, 19);
          const ort = ortszeitLesen(text);
          expect(ort && tagVon(ort)).toBe(text.slice(0, 10));
        },
      ),
    );
  });
});
