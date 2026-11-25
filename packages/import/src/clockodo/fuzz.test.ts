import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_DATENSAETZE } from "../modell.ts";
import { clockodoLesen } from "./index.ts";

/*
 * No file breaks or hangs the Clockodo reader (BAULISTE.md S-703): fast-check over any text, over
 * lines of the CSV backup with valid and broken fields, and over JSON Lines with wrong types, and the
 * largest files the server accepts within 1 s.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const CSV_KOPF =
  "Id,Co-worker Id,Project Id,Customer Id,Service Id,Begin (UTC),End (UTC),Correction of time in seconds,Lump sum value,Co-worker,Customer,Project,Service";
const ABZUG_KOPF =
  '{"format":"soll-clockodo-api","version":1,"von":"2026-01-01","bis":"2026-12-31"}';

const gelesenOhneWurf = (text: string) => {
  const start = performance.now();
  const gelesen = clockodoLesen(text);
  expect(performance.now() - start).toBeLessThan(1000);
  for (const fehler of gelesen.fehler) expect(fehler.zeile).toBeGreaterThanOrEqual(1);
  return gelesen;
};

const zeitpunkt = fc.oneof(
  fc
    .date({ min: new Date("1999-01-01"), max: new Date("2101-01-01"), noInvalidDate: true })
    .map((d) => d.toISOString().replace(/\.\d{3}Z$/, "Z")),
  fc.string(),
  fc.constant(""),
);
const zahl = fc.oneof(fc.integer({ min: -5, max: 1e6 }).map(String), fc.string(), fc.constant(""));
const csvFeld = fc.oneof(zahl, zeitpunkt, fc.string(), fc.constant('"'), fc.constant(","));

const jsonWert = fc.oneof(
  fc.integer(),
  fc.double(),
  fc.string(),
  fc.boolean(),
  fc.constant(null),
  zeitpunkt,
  fc.array(fc.integer(), { maxLength: 2 }),
);
const jsonZeile = fc.record(
  {
    kind: fc.constantFrom("user", "customer", "project", "service", "entry", "absence", "x", 1),
    id: jsonWert,
    users_id: jsonWert,
    customers_id: jsonWert,
    name: jsonWert,
    number: jsonWert,
    type: fc.oneof(fc.integer({ min: 0, max: 16 }), jsonWert),
    time_since: zeitpunkt,
    time_until: fc.oneof(zeitpunkt, fc.constant(null)),
    offset: jsonWert,
    date_since: fc.oneof(fc.constant("2026-09-01"), jsonWert),
    date_until: fc.oneof(fc.constant("2026-09-03"), jsonWert),
    status: fc.oneof(fc.integer({ min: 0, max: 4 }), jsonWert),
    count_days: jsonWert,
    count_hours: jsonWert,
  },
  { requiredKeys: ["kind"] },
);

describe("the Clockodo reader never throws or hangs", () => {
  it("on any text", () => {
    fc.assert(fc.property(fc.string({ maxLength: 2000 }), (text) => void gelesenOhneWurf(text)));
  });

  it("on lines of a CSV backup with valid and broken fields", () => {
    const zeile = fc.array(csvFeld, { minLength: 0, maxLength: 15 }).map((f) => f.join(","));
    fc.assert(
      fc.property(fc.array(zeile, { maxLength: 30 }), (zeilen) => {
        gelesenOhneWurf([CSV_KOPF, ...zeilen].join("\n"));
      }),
    );
  });

  it("on JSON Lines with fields of any type", () => {
    const zeile = fc.oneof(
      jsonZeile.map((z) => JSON.stringify(z)),
      fc.string(),
    );
    fc.assert(
      fc.property(fc.array(zeile, { maxLength: 30 }), (zeilen) => {
        gelesenOhneWurf([ABZUG_KOPF, ...zeilen].join("\n"));
      }),
    );
  });
});

describe("the Clockodo reader stays within 1 s for any file the server accepts", () => {
  const eintrag = (i: number) =>
    `${i},11,,201,401,2026-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, "0")}T0${i % 10}:00:00Z,2026-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, "0")}T1${i % 10}:00:00Z,0,,Sandra,Elbhof,,Montage`;
  for (const [name, text] of [
    ["a header of 5 MiB", ",".repeat(MAX_BYTES)],
    ["a quote never closed", `${CSV_KOPF}\n${'"'.repeat(MAX_BYTES)}`],
    ["one long line of JSON", `${ABZUG_KOPF}\n{"kind":"user","name":"${"x".repeat(MAX_BYTES)}"}`],
    ["deeply nested JSON", `${ABZUG_KOPF}\n${"[".repeat(MAX_BYTES / 2)}`],
    [
      "nested arrays in a record",
      `${ABZUG_KOPF}\n{"kind":"user","name":${"[".repeat(MAX_BYTES / 2)}`,
    ],
    ["nested objects in a record", `${ABZUG_KOPF}\n${`{"a":`.repeat(MAX_BYTES / 5)}`],
    [
      "the most entries of the backup",
      [CSV_KOPF, ...Array.from({ length: MAX_DATENSAETZE }, (_, i) => eintrag(i))].join("\n"),
    ],
  ] as const)
    it(name, () => {
      gelesenOhneWurf(text);
    });

  it("refuses more records than one import takes", () => {
    const text = [ABZUG_KOPF, ...Array.from({ length: MAX_DATENSAETZE + 1 }, () => "{}")].join(
      "\n",
    );
    expect(gelesenOhneWurf(text).fehler).toEqual([
      { zeile: MAX_DATENSAETZE + 2, grund: "zu_viele" },
    ]);
  });
});
