import { type ImportDaten, leer } from "@soll/import";
import { describe, expect, it } from "vitest";
import { planen } from "./plan.ts";
import { stand, um, ZUORDNUNG, zeit } from "./plan-testhilfen.ts";

// Review 2 S-705: the mapping lets two persons of the tool name one member (importe.ts,
// `personen: z.record(...)`, no uniqueness) – e.g. an old and a new Kimai account of Sandra.
// The time of the first account is taken over; the second account's overlapping time is refused
// (ueberschneidung). The booking of the time taken over must stay: BAULISTE.md S-705 "Aus jeder
// übernommenen Zeitbuchung mit Projekt wird eine Buchung der Projektzeit". Fix 2 matches refused
// times only by member and span and drops it as `ausgelassen`.
const daten: ImportDaten = {
  ...leer(),
  kunden: [{ externalId: "k1", zeile: 2, name: "Elbhof", nummer: "" }],
  projekte: [{ externalId: "p1", zeile: 3, kunde: "k1", name: "Bad", nummer: "" }],
  taetigkeiten: [{ externalId: "t1", zeile: 4, name: "Montage" }],
  zeiten: [
    zeit("10", "2026-09-01", 7 * 60, 11 * 60, 0, 10),
    { ...zeit("20", "2026-09-01", 10 * 60, 12 * 60, 0, 20), person: "Sandra alt" },
  ],
  buchungen: [
    {
      externalId: "10/1",
      zeile: 10,
      zeit: "10",
      person: "Sandra Kühn",
      tag: "2026-09-01",
      beginn: um("2026-09-01T07:00:00+02:00"),
      ende: um("2026-09-01T11:00:00+02:00"),
      projekt: "p1",
      taetigkeit: "t1",
    },
  ],
};

describe("review 2 S-705: two tool accounts on one member", () => {
  it("keeps the booking of the time taken over when another account's time is refused", () => {
    const zuordnung = {
      ...ZUORDNUNG,
      personen: { ...ZUORDNUNG.personen, "Sandra alt": "sandra" },
    };
    const plan = planen(daten, zuordnung, null, stand());
    expect(plan.abgelehnt.map((a) => [a.art, a.grund])).toEqual([["zeiten", "ueberschneidung"]]);
    expect(plan.zahlen.zeiten.neu).toBe(1);
    expect(plan.buchungen.map((b) => b.externId)).toEqual(["10/1"]);
  });
});
