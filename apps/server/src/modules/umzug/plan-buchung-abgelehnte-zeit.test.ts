import { type ImportDaten, leer } from "@soll/import";
import { describe, expect, it } from "vitest";
import { planen } from "./plan.ts";
import { stand, um, ZUORDNUNG, zeit } from "./plan-testhilfen.ts";

// Review S-705: BAULISTE.md S-705 "Aus jeder übernommenen Zeitbuchung mit Projekt wird eine Buchung
// der Projektzeit" – a timesheet whose time is refused (here: closed month) is not taken over, so
// it gives no booking either (as S-702: bookings only for a time taken over).
const daten: ImportDaten = {
  ...leer(),
  kunden: [{ externalId: "k1", zeile: 2, name: "Elbhof", nummer: "" }],
  projekte: [{ externalId: "p1", zeile: 3, kunde: "k1", name: "Bad", nummer: "" }],
  taetigkeiten: [{ externalId: "t1", zeile: 4, name: "Montage" }],
  zeiten: [zeit("10", "2026-09-01", 7 * 60, 11 * 60, 0, 10)],
  buchungen: [
    {
      externalId: "10/1",
      zeile: 10,
      person: "Sandra Kühn",
      tag: "2026-09-01",
      beginn: um("2026-09-01T07:00:00+02:00"),
      ende: um("2026-09-01T11:00:00+02:00"),
      projekt: "p1",
      taetigkeit: "t1",
    },
  ],
};

describe("review S-705: booking of a refused time", () => {
  it("gives no booking when the time is refused for a closed month", () => {
    const plan = planen(daten, ZUORDNUNG, null, stand({ geschlossen: () => new Set(["2026-09"]) }));
    expect(plan.abgelehnt.map((a) => [a.art, a.grund])).toContainEqual([
      "zeiten",
      "monat_abgeschlossen",
    ]);
    expect(plan.buchungen).toEqual([]);
  });
});
