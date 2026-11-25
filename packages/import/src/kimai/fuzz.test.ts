import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_DATENSAETZE } from "../modell.ts";
import { inZeit } from "../zeit-testhilfen.ts";
import { KIMAI_FORMAT, kimaiAbzugText, kimaiLesen } from "./index.ts";
import { zeitpunktLesen } from "./werte.ts";

/*
 * Fuzzing of Kimai's reader (BAULISTE.md S-705): no file makes it throw or take longer than 1 s
 * (docs/plan.md, "Zeitgrenze der Leser in den Tests"),
 * and every error names a line of the file.
 */

const KOPF = JSON.stringify({
  format: KIMAI_FORMAT,
  version: 1,
  von: "2026-01-01",
  bis: "2026-12-31",
});

const lesen = (text: string) => kimaiLesen(new TextEncoder().encode(text));

const zeitpunkt = fc.oneof(
  fc
    .date({ min: new Date("1990-01-01"), max: new Date("2110-01-01"), noInvalidDate: true })
    .map((d) => d.toISOString().replace(/\.\d{3}Z$/, "+0200")),
  fc.string(),
  fc.constant("2026-10-25T02:30:00+0100"),
  fc.constant("2026-03-29T02:30:00+0100"),
  fc.constant(null),
);

const wert = fc.oneof(fc.string(), fc.integer(), fc.double(), fc.boolean(), fc.constant(null));
const kennung = fc.oneof(fc.integer({ min: -2, max: 30 }), fc.string(), fc.constant(null));

const satz = fc.oneof(
  fc.record({ kind: fc.constant("user"), id: kennung, username: wert, alias: wert }),
  fc.record({
    kind: fc.constantFrom("customer", "activity"),
    id: kennung,
    name: wert,
    number: wert,
    project: kennung,
  }),
  fc.record({
    kind: fc.constant("project"),
    id: kennung,
    customer: kennung,
    name: wert,
    number: wert,
  }),
  fc.record({
    kind: fc.constant("timesheet"),
    id: kennung,
    user: kennung,
    begin: zeitpunkt,
    end: zeitpunkt,
    break: fc.oneof(fc.integer({ min: -10, max: 90_000 }), wert),
    project: kennung,
    activity: kennung,
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
};

describe("kimaiLesen under fuzzing", () => {
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
          kimaiAbzugText({
            von: "2026-01-01",
            bis: "2026-12-31",
            user: liste,
            customer: liste,
            project: liste,
            activity: liste,
            timesheet: liste,
          }),
        ),
      ),
      { numRuns: 200 },
    );
  });

  it("reads 20,000 timesheets within 1 s and refuses one more", () => {
    const zeilen = Array.from({ length: MAX_DATENSAETZE }, (_, i) =>
      JSON.stringify({
        kind: "timesheet",
        id: i + 1,
        user: (i % 7) + 1,
        begin: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000)
          .toISOString()
          .replace(/\.\d{3}Z$/, "Z"),
        end: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000 + 1_800_000)
          .toISOString()
          .replace(/\.\d{3}Z$/, "Z"),
        break: 0,
        project: null,
        activity: null,
      }),
    );
    pruefen([KOPF, ...zeilen].join("\n"));
    expect(lesen([KOPF, ...zeilen, zeilen[0]].join("\n")).fehler).toEqual([
      { zeile: MAX_DATENSAETZE + 2, grund: "zu_viele" },
    ]);
  });

  it("refuses a line of deeply nested brackets at once", () => {
    pruefen(`${KOPF}\n{"kind":"user","id":${"[".repeat(1_000_000)}`);
  });

  it("reads an instant back to the instant it was written from", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-02"), max: new Date("2099-12-30"), noInvalidDate: true }),
        fc.integer({ min: -12, max: 14 }),
        (datum, stunden) => {
          const ms = Math.floor(datum.getTime() / 1000) * 1000;
          const lokal = new Date(ms + stunden * 3_600_000).toISOString().slice(0, 19);
          const versatz = `${stunden < 0 ? "-" : "+"}${String(Math.abs(stunden)).padStart(2, "0")}00`;
          expect(zeitpunktLesen(`${lokal}${versatz}`)).toBe(ms);
        },
      ),
    );
  });
});
