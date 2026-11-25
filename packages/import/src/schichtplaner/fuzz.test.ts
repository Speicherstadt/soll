import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { inZeit } from "../zeit-testhilfen.ts";
import { crewmeisterAbzug } from "./crewmeister.ts";
import { SCHICHTPLANER_FORMAT, schichtplanerAbzugText, schichtplanerLesen } from "./index.ts";
import { papershiftAbzug } from "./papershift.ts";

/*
 * Fuzzing of the shift planners' reader and of the turning of their answers into records
 * (BAULISTE.md S-706): no file and no answer makes them throw or take longer than 1 s
 * (docs/plan.md, "Zeitgrenze der Leser in den Tests"), and every error names a line of the file.
 */

const KOPF = JSON.stringify({
  format: SCHICHTPLANER_FORMAT,
  version: 1,
  tool: "crewmeister",
  from: "2026-01-01",
  to: "2026-12-31",
});

const lesen = (text: string) => schichtplanerLesen("crewmeister")(new TextEncoder().encode(text));

const zeitpunkt = fc.oneof(
  fc
    .date({ min: new Date("1990-01-01"), max: new Date("2110-01-01"), noInvalidDate: true })
    .map((d) => d.toISOString()),
  fc.string(),
  fc.constant("2026-10-25T00:30:00Z"),
  fc.constant("2026-03-29T02:30:00"),
  fc.constant(null),
);
const wert = fc.oneof(fc.string(), fc.integer(), fc.double(), fc.boolean(), fc.constant(null));
const kennung = fc.oneof(fc.integer({ min: -2, max: 30 }), fc.string(), fc.constant(null));

const satz = fc.oneof(
  fc.record({ kind: fc.constant("person"), id: kennung, name: wert }),
  fc.record({
    kind: fc.constant("shift"),
    id: kennung,
    person: kennung,
    begin: zeitpunkt,
    end: zeitpunkt,
    break: wert,
    role: wert,
  }),
  fc.record({
    kind: fc.constant("work"),
    id: kennung,
    person: kennung,
    begin: zeitpunkt,
    end: zeitpunkt,
  }),
  fc.record({
    kind: fc.constantFrom("absence", "other"),
    id: kennung,
    person: kennung,
    type: wert,
    from: fc.oneof(fc.constant("2026-09-01"), wert),
    to: fc.oneof(fc.constant("2026-09-02"), wert),
    first_half: wert,
    last_half: wert,
    approved: wert,
    part_day: wert,
  }),
);

describe("schichtplanerLesen under fuzzing", () => {
  it("never throws on any text and names a line for every error", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const gelesen = lesen(text);
        for (const f of gelesen.fehler) expect(f.zeile).toBeGreaterThanOrEqual(1);
      }),
    );
  });

  it("never throws on lines of right and wrong fields; every error names a line of the file", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            satz.map((s) => JSON.stringify(s)),
            fc.string(),
          ),
        ),
        (zeilen) => {
          const text = [KOPF, ...zeilen].join("\n");
          const gelesen = lesen(text);
          for (const f of gelesen.fehler) {
            expect(f.zeile).toBeGreaterThanOrEqual(2);
            expect(f.zeile).toBeLessThanOrEqual(zeilen.length + 1);
          }
        },
      ),
    );
  });

  it("reads 20,000 pieces of work within the time limit", () => {
    const zeilen = Array.from({ length: 20_000 }, (_, i) => {
      const beginn = Date.parse("2026-01-01T07:00:00Z") + (i % 365) * 86_400_000 + (i % 7) * 60_000;
      return JSON.stringify({
        kind: "work",
        id: String(i),
        person: String(i % 30),
        begin: new Date(beginn).toISOString(),
        end: new Date(beginn + 8 * 3_600_000).toISOString(),
      });
    });
    const text = `${[KOPF, ...zeilen].join("\n")}\n`;
    inZeit(() => lesen(text));
  });
});

const antwort = fc.array(
  fc.oneof(fc.dictionary(fc.string(), fc.oneof(wert, zeitpunkt, fc.array(wert))), wert),
  { maxLength: 20 },
);
const feld = fc.constantFrom(
  "id",
  "userId",
  "user_id",
  "timestamp",
  "stampType",
  "chainStartStampId",
  "from",
  "to",
  "starts_at",
  "ends_at",
  "breaks",
);
const antwortMitFeldern = fc.array(fc.dictionary(feld, fc.oneof(wert, zeitpunkt)), {
  maxLength: 20,
});

describe("the turning of answers into records under fuzzing", () => {
  const zeitraum = { von: "2026-09-01", bis: "2026-09-30" };

  it("never throws for Crewmeister, and the file it makes reads without a throw", () => {
    fc.assert(
      fc.property(fc.oneof(antwort, antwortMitFeldern), antwortMitFeldern, (a, b) => {
        const text = schichtplanerAbzugText(
          crewmeisterAbzug(
            { members: a, absenceTypes: a, absences: b, stamps: b, shifts: b, workplaces: a },
            zeitraum,
          ),
        );
        expect(() => lesen(text)).not.toThrow();
      }),
    );
  });

  it("never throws for Papershift", () => {
    fc.assert(
      fc.property(fc.oneof(antwort, antwortMitFeldern), antwortMitFeldern, (a, b) => {
        const text = schichtplanerAbzugText(
          papershiftAbzug({ users: a, absenceTypes: a, absences: b, workingSessions: b }, zeitraum),
        );
        expect(() =>
          schichtplanerLesen("papershift")(new TextEncoder().encode(text)),
        ).not.toThrow();
      }),
    );
  });
});
