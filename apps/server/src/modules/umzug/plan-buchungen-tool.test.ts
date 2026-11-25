import { type ImportBuchung, type ImportDaten, leer } from "@soll/import";
import { describe, expect, it } from "vitest";
import { planen } from "./plan.ts";
import { stand, um, ZUORDNUNG } from "./plan-testhilfen.ts";

/*
 * The plan of the bookings a tool kept itself (BAULISTE.md S-705): on the project and activity the
 * import creates or matches for the ids they name, left out with them, refused when they overlap.
 */

const buchung = (id: string, beginn: string, ende: string, zeile = 10): ImportBuchung => ({
  externalId: id,
  zeile,
  zeit: id.split("/")[0] as string,
  person: "Sandra Kühn",
  tag: "2026-09-01",
  beginn: um(beginn),
  ende: um(ende),
  projekt: "p1",
  taetigkeit: "t1",
});

const daten = (...buchungen: ImportBuchung[]): ImportDaten => ({
  ...leer(),
  kunden: [{ externalId: "k1", zeile: 2, name: "Elbhof", nummer: "" }],
  projekte: [{ externalId: "p1", zeile: 3, kunde: "k1", name: "Bad", nummer: "" }],
  taetigkeiten: [{ externalId: "t1", zeile: 4, name: "Montage" }],
  buchungen,
});

const MORGEN = buchung("10/1", "2026-09-01T07:00:00+02:00", "2026-09-01T11:00:00+02:00");

describe("bookings a tool kept itself", () => {
  it("books on the project and activity the same run creates", () => {
    const plan = planen(daten(MORGEN), ZUORDNUNG, null, stand());
    const projektId = plan.projekte[0]?.projektId;
    const taetigkeitId = plan.taetigkeiten[0]?.taetigkeitId;
    expect(plan.buchungen).toEqual([
      {
        nutzerId: "sandra",
        projektId,
        taetigkeitId,
        beginn: MORGEN.beginn,
        ende: MORGEN.ende,
        tag: "2026-09-01",
        externId: "10/1",
      },
    ]);
    expect(plan.zahlen.buchungen).toEqual({ neu: 1, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 });
  });

  it("books on an activity the owner matched, and leaves one out with its activity", () => {
    const zugeordnet = { ...ZUORDNUNG, taetigkeiten: { t1: { id: "montage" } } };
    expect(planen(daten(MORGEN), zugeordnet, null, stand()).buchungen[0]?.taetigkeitId).toBe(
      "montage",
    );
    const aus = planen(daten(MORGEN), { ...ZUORDNUNG, taetigkeiten: { t1: "aus" } }, null, stand());
    expect(aus.buchungen).toEqual([]);
    expect(aus.zahlen.buchungen.ausgelassen).toBe(1);
  });

  it("refuses an overlap within the run and with a booking there, and one in the future", () => {
    const zweite = buchung("11/1", "2026-09-01T10:00:00+02:00", "2026-09-01T12:00:00+02:00", 11);
    const spaeter = buchung("12/1", "2026-12-01T10:00:00+01:00", "2026-12-01T12:00:00+01:00", 12);
    const plan = planen(daten(MORGEN, zweite, spaeter), ZUORDNUNG, null, stand());
    expect(plan.abgelehnt).toEqual([
      { art: "buchungen", zeile: 11, externalId: "11/1", grund: "ueberschneidung" },
      { art: "buchungen", zeile: 12, externalId: "12/1", grund: "zukunft" },
    ]);
    const belegt = planen(
      daten(MORGEN),
      ZUORDNUNG,
      null,
      stand({ buchungUeberschneidet: () => true }),
    );
    expect(belegt.abgelehnt.map((a) => a.grund)).toEqual(["ueberschneidung"]);
  });

  it("finds a booking taken over before, and refuses all without the module", () => {
    const vorher = stand();
    const wieder = planen(
      daten(MORGEN),
      ZUORDNUNG,
      null,
      stand({ vorhanden: { ...vorher.vorhanden, buchungen: new Set(["10/1"]) } }),
    );
    expect(wieder.zahlen.buchungen).toMatchObject({ neu: 0, vorhanden: 1 });
    const ohne = planen(
      daten(MORGEN),
      ZUORDNUNG,
      null,
      stand({ module: { arbeitszeit: true, projektzeit: false, dienstplan: true } }),
    );
    expect(ohne.abgelehnt.map((a) => [a.art, a.grund])).toEqual([
      ["kunden", "modul_aus"],
      ["projekte", "modul_aus"],
      ["taetigkeiten", "modul_aus"],
      ["buchungen", "modul_aus"],
    ]);
  });

  it("leaves out the bookings of a person left out", () => {
    const plan = planen(daten(MORGEN), { ...ZUORDNUNG, personen: {} }, null, stand());
    expect(plan.zahlen.buchungen.ausgelassen).toBe(1);
  });
});
