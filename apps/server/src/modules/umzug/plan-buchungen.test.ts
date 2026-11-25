import type { ImportZeit, Zuordnung } from "@soll/import";
import { describe, expect, it } from "vitest";
import { planen } from "./plan.ts";
import { buchungKennung } from "./plan-buchungen.ts";
import { gespeichert, mitZeiten, stand, um, ZUORDNUNG, zeit } from "./plan-testhilfen.ts";

/** Sandra's 1 September, 7:00 to 15:30 with 30 minutes, at Bad Elbhof as fitting */
const montage = (aenderung: Partial<ImportZeit> = {}): ImportZeit => ({
  ...zeit("z-1", "2026-09-01", 7 * 60, 15 * 60 + 30, 30),
  projekt: "Bad Elbhof",
  taetigkeit: "Montage",
  ...aenderung,
});

const MIT_BUCHUNG: Zuordnung = {
  ...ZUORDNUNG,
  buchung: { projekte: { "Bad Elbhof": "bad" }, taetigkeiten: { Montage: "montage", "": "fahrt" } },
};

describe("bookings from the project and activity of a time (S-702)", () => {
  it("books each piece of work before and after the break in the middle", () => {
    const plan = planen(mitZeiten(montage()), MIT_BUCHUNG, null, stand());
    expect(plan.zahlen.zeiten.neu).toBe(1);
    expect(plan.zahlen.buchungen).toEqual({ neu: 1, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 });
    expect(plan.buchungen).toEqual([
      {
        nutzerId: "sandra",
        projektId: "bad",
        taetigkeitId: "montage",
        beginn: um("2026-09-01T07:00:00+02:00"),
        ende: um("2026-09-01T11:00:00+02:00"),
        tag: "2026-09-01",
        externId: "z-1/buchung/1",
      },
      {
        nutzerId: "sandra",
        projektId: "bad",
        taetigkeitId: "montage",
        beginn: um("2026-09-01T11:30:00+02:00"),
        ende: um("2026-09-01T15:30:00+02:00"),
        tag: "2026-09-01",
        externId: "z-1/buchung/2",
      },
    ]);
  });

  it("books a night shift on the day it starts, and a time without a break in one piece", () => {
    const nacht = montage({ tag: "2026-09-30", beginn: 22 * 60, ende: 6 * 60, pauseMinuten: 0 });
    const plan = planen(mitZeiten(nacht), MIT_BUCHUNG, null, stand());
    expect(plan.buchungen).toEqual([
      expect.objectContaining({
        beginn: um("2026-09-30T22:00:00+02:00"),
        ende: um("2026-10-01T06:00:00+02:00"),
        tag: "2026-09-30",
      }),
    ]);
  });

  it("takes the activity chosen for times without one, and none without a project", () => {
    const { taetigkeit: _t, ...ohneTaetigkeit } = montage();
    const { projekt: _p, ...ohneProjekt } = montage({ externalId: "z-2", tag: "2026-09-02" });
    const plan = planen(mitZeiten(ohneTaetigkeit, ohneProjekt), MIT_BUCHUNG, null, stand());
    expect(plan.buchungen.map((b) => [b.externId, b.projektId, b.taetigkeitId])).toEqual([
      ["z-1/buchung/1", "bad", "fahrt"],
      ["z-1/buchung/2", "bad", "fahrt"],
      ["z-2/buchung/1", null, "montage"],
      ["z-2/buchung/2", null, "montage"],
    ]);
  });

  it("leaves the booking out when the owner leaves the project or activity out, not the time", () => {
    const zuordnung = {
      ...ZUORDNUNG,
      buchung: { projekte: { "Bad Elbhof": null }, taetigkeiten: {} },
    };
    const plan = planen(mitZeiten(montage()), zuordnung, null, stand());
    expect(plan.zahlen.zeiten.neu).toBe(1);
    expect(plan.zahlen.buchungen.ausgelassen).toBe(1);
    expect(plan.buchungen).toEqual([]);
    // a time without project and activity has no booking to count
    const ohne = zeit("z-3", "2026-09-03", 420, 480);
    expect(planen(mitZeiten(ohne), MIT_BUCHUNG, null, stand()).zahlen.buchungen.ausgelassen).toBe(
      0,
    );
  });

  it("refuses the booking, not the time, without Projektzeit or over a booking there already", () => {
    const aus = planen(
      mitZeiten(montage()),
      MIT_BUCHUNG,
      null,
      stand({ module: { arbeitszeit: true, projektzeit: false, dienstplan: true } }),
    );
    expect(aus.zahlen.zeiten.neu).toBe(1);
    expect(aus.abgelehnt).toEqual([
      { art: "buchungen", zeile: 2, externalId: "z-1", grund: "modul_aus" },
    ]);
    const belegt = planen(
      mitZeiten(montage()),
      MIT_BUCHUNG,
      null,
      stand({ buchungUeberschneidet: () => true }),
    );
    expect(belegt.zahlen.zeiten.neu).toBe(1);
    expect(belegt.abgelehnt).toEqual([
      { art: "buchungen", zeile: 2, externalId: "z-1", grund: "ueberschneidung" },
    ]);
    expect(belegt.buchungen).toEqual([]);
  });

  it("finds the bookings of a time taken over before, and does not book one afterwards", () => {
    const vorhanden = (buchungen: string[]) =>
      stand({
        vorhanden: {
          stempelungen: gespeichert("sandra", montage()),
          abwesenheiten: new Map(),
          kunden: new Map(),
          projekte: new Set(),
          taetigkeiten: new Map(),
          buchungen: new Set(buchungen),
          schichten: new Map(),
        },
      });
    const wieder = planen(
      mitZeiten(montage()),
      MIT_BUCHUNG,
      null,
      vorhanden([buchungKennung("z-1", 1)]),
    );
    expect(wieder.zahlen.zeiten.vorhanden).toBe(1);
    expect(wieder.zahlen.buchungen).toEqual({ neu: 0, vorhanden: 1, ausgelassen: 0, abgelehnt: 0 });
    const ohne = planen(mitZeiten(montage()), MIT_BUCHUNG, null, vorhanden([]));
    expect(ohne.zahlen.buchungen).toEqual({ neu: 0, vorhanden: 0, ausgelassen: 1, abgelehnt: 0 });
    expect(ohne.buchungen).toEqual([]);
  });
});
