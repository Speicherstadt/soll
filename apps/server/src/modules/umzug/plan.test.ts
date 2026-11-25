import type { Stempelung } from "@soll/arbeitszeit";
import { type ImportDaten, leer, type Zuordnung } from "@soll/import";
import { describe, expect, it } from "vitest";
import { planen } from "./plan.ts";
import { gespeichert, mitZeiten, stand, um, ZUORDNUNG, zeit } from "./plan-testhilfen.ts";
import { stempelAus } from "./plan-zeiten.ts";

describe("a span of another tool as stamps", () => {
  it("stamps Kommen, Gehen and the break in the middle, on whole minutes", () => {
    expect(stempelAus(zeit("z", "2026-09-01", 7 * 60, 15 * 60 + 30, 30))).toEqual([
      { art: "kommen", zeitpunkt: um("2026-09-01T07:00:00+02:00") },
      { art: "pause_beginn", zeitpunkt: um("2026-09-01T11:00:00+02:00") },
      { art: "pause_ende", zeitpunkt: um("2026-09-01T11:30:00+02:00") },
      { art: "gehen", zeitpunkt: um("2026-09-01T15:30:00+02:00") },
    ]);
    // 7:00 to 15:01 with 30 minutes: 451 minutes of work, 225 before the break
    expect((stempelAus(zeit("z", "2026-09-01", 420, 901, 30)) as Stempelung[])[1]).toEqual({
      art: "pause_beginn",
      zeitpunkt: um("2026-09-01T10:45:00+02:00"),
    });
  });

  it("ends a night shift on the next day, the day it began staying its working day", () => {
    expect(stempelAus(zeit("z", "2026-11-20", 22 * 60, 6 * 60))).toEqual([
      { art: "kommen", zeitpunkt: um("2026-11-20T22:00:00+01:00") },
      { art: "gehen", zeitpunkt: um("2026-11-21T06:00:00+01:00") },
    ]);
  });

  it("counts the real minutes of the nights the clocks change, and refuses a time they skip", () => {
    // 25.10.2026: 22:00 to 6:00 holds nine hours, so a break of 8:30 still fits
    expect(stempelAus(zeit("z", "2026-10-24", 22 * 60, 6 * 60, 510))).toHaveLength(4);
    // 28.03.2027: 22:00 to 6:00 holds seven hours, a break of 7:30 does not fit
    expect(stempelAus(zeit("z", "2027-03-27", 22 * 60, 6 * 60, 450))).toBe("pause_ungueltig");
    expect(stempelAus(zeit("z", "2027-03-28", 2 * 60 + 30, 8 * 60))).toBe("zeit_gibt_es_nicht");
  });
});

describe("the plan of a takeover", () => {
  it("plans new stamps with their ids and counts what is there already", () => {
    const daten = mitZeiten(
      zeit("z-1", "2026-09-01", 420, 900),
      zeit("z-2", "2026-09-02", 420, 900, 0, 3),
    );
    const stempelungen = gespeichert("sandra", zeit("z-1", "2026-09-01", 420, 900));
    const vorhanden = { ...stand().vorhanden, stempelungen };
    const plan = planen(daten, ZUORDNUNG, null, stand({ vorhanden }));
    expect(plan.zahlen.zeiten).toEqual({ neu: 1, vorhanden: 1, ausgelassen: 0, abgelehnt: 0 });
    expect(plan.stempelungen.map((s) => [s.nutzerId, s.art, s.externId])).toEqual([
      ["sandra", "kommen", "z-2/kommen"],
      ["sandra", "gehen", "z-2/gehen"],
    ]);
  });

  it("leaves out persons and kinds the owner did not map, and refuses a person not a member", () => {
    const daten: ImportDaten = {
      ...mitZeiten(
        { ...zeit("z-1", "2026-09-01", 420, 900), person: "Leon Albers" },
        { ...zeit("z-2", "2026-09-01", 420, 900, 0, 3), person: "Yusuf" },
      ),
      abwesenheiten: [
        {
          externalId: "a",
          zeile: 4,
          person: "Max Brandt",
          art: "Elternzeit",
          von: "2026-09-01",
          bis: "2026-09-02",
        },
      ],
    };
    const plan = planen(daten, { ...ZUORDNUNG, personen: { Yusuf: "fremd" } }, null, stand());
    expect(plan.zahlen.zeiten).toEqual({ neu: 0, vorhanden: 0, ausgelassen: 1, abgelehnt: 1 });
    expect(plan.zahlen.abwesenheiten.ausgelassen).toBe(1);
    expect(plan.abgelehnt).toEqual([
      { art: "zeiten", zeile: 3, externalId: "z-2", grund: "person_unbekannt" },
    ]);
  });

  it("refuses spans that overlap stamps there already or each other, and spans in the future", () => {
    const daten = mitZeiten(
      zeit("z-1", "2026-09-01", 420, 900, 0, 2),
      zeit("z-2", "2026-09-01", 840, 1000, 0, 3),
      zeit("z-3", "2026-09-02", 420, 900, 0, 4),
      zeit("z-4", "2026-09-03", 420, 900, 0, 5),
      zeit("z-5", "2026-11-25", 420, 900, 0, 6),
    );
    const vorhandene: Stempelung[] = [
      { art: "kommen", zeitpunkt: um("2026-09-02T10:00:00+02:00") },
      { art: "gehen", zeitpunkt: um("2026-09-02T18:00:00+02:00") },
      { art: "kommen", zeitpunkt: um("2026-09-03T06:00:00+02:00") },
    ];
    const plan = planen(daten, ZUORDNUNG, null, stand({ stempelVon: () => vorhandene }));
    expect(plan.abgelehnt.map((a) => [a.externalId, a.grund])).toEqual([
      ["z-2", "ueberschneidung"],
      ["z-3", "ueberschneidung"],
      ["z-4", "ueberschneidung"],
      ["z-5", "zukunft"],
    ]);
  });

  it("refuses what would change a month closed in Soll, and the times without the module", () => {
    const daten = mitZeiten(
      zeit("z-1", "2026-09-01", 420, 900),
      zeit("z-2", "2026-10-30", 420, 900, 0, 3),
    );
    const geschlossen = planen(
      daten,
      ZUORDNUNG,
      null,
      stand({ geschlossen: () => new Set(["2026-09"]) }),
    );
    expect(geschlossen.abgelehnt.map((a) => a.grund)).toEqual(["monat_abgeschlossen"]);
    const nacht = planen(
      daten,
      ZUORDNUNG,
      null,
      stand({
        geschlossen: () => new Set(["2026-11"]),
        stempelGesperrt: (_, neu) => neu.length > 0,
      }),
    );
    expect(nacht.zahlen.zeiten.abgelehnt).toBe(2);
    const aus = planen(
      daten,
      ZUORDNUNG,
      null,
      stand({ module: { arbeitszeit: false, projektzeit: true } }),
    );
    expect(aus.abgelehnt.map((a) => a.grund)).toEqual(["modul_aus", "modul_aus"]);
  });

  it("plans approved absences, refusing overlaps but letting sickness fall into leave", () => {
    const satz = (externalId: string, art: string, von: string, bis: string, zeile: number) => ({
      externalId,
      zeile,
      person: "Max Brandt",
      art,
      von,
      bis,
    });
    const daten: ImportDaten = {
      ...leer(),
      abwesenheiten: [
        satz("a-1", "Urlaub", "2026-09-07", "2026-09-11", 2),
        satz("a-2", "Krank", "2026-09-09", "2026-09-09", 3),
        satz("a-3", "Urlaub", "2026-09-11", "2026-09-14", 4),
        satz("a-4", "Urlaub", "2026-08-03", "2026-08-04", 5),
      ],
    };
    const plan = planen(
      daten,
      ZUORDNUNG,
      null,
      stand({ abwesenheitenVon: () => [{ art: "urlaub", von: "2026-08-04", bis: "2026-08-05" }] }),
    );
    expect(plan.abwesenheiten.map((a) => [a.externId, a.art, a.von, a.bis])).toEqual([
      ["a-1", "urlaub", "2026-09-07", "2026-09-11"],
      ["a-2", "krank", "2026-09-09", "2026-09-09"],
    ]);
    expect(plan.abgelehnt.map((a) => [a.externalId, a.grund])).toEqual([
      ["a-3", "ueberschneidung"],
      ["a-4", "ueberschneidung"],
    ]);
  });

  it("creates customers and their orders once, maps to existing ones, and leaves out", () => {
    const daten: ImportDaten = {
      ...leer(),
      kunden: [
        { externalId: "k-1", zeile: 2, name: "Elbhof", nummer: "" },
        { externalId: "k-2", zeile: 3, name: "Hansen", nummer: "K-2" },
        { externalId: "k-3", zeile: 4, name: "Weg", nummer: "" },
      ],
      projekte: [
        { externalId: "p-1", zeile: 5, kunde: "k-1", name: "Bad", nummer: "" },
        { externalId: "p-2", zeile: 6, kunde: "k-2", name: "Heizung", nummer: "" },
        { externalId: "p-3", zeile: 7, kunde: "k-3", name: "Dach", nummer: "" },
        { externalId: "p-4", zeile: 8, kunde: "k-2", name: "Alt", nummer: "" },
      ],
    };
    const zuordnung: Zuordnung = {
      ...ZUORDNUNG,
      kunden: { "k-1": { id: "elbhof" }, "k-3": "aus" },
      projekte: { "p-4": { id: "weg" } },
    };
    const vorhanden = { ...stand().vorhanden, kunden: new Map([["k-2", "hansen"]]) };
    const plan = planen(daten, zuordnung, null, stand({ vorhanden }));
    expect(plan.kunden).toEqual([]);
    expect(plan.projekte).toEqual([
      { projektId: "id-1", kundeId: "elbhof", name: "Bad", nummer: "", externId: "p-1" },
      { projektId: "id-2", kundeId: "hansen", name: "Heizung", nummer: "", externId: "p-2" },
    ]);
    expect(plan.zahlen.kunden).toEqual({ neu: 0, vorhanden: 2, ausgelassen: 1, abgelehnt: 0 });
    expect(plan.abgelehnt.map((a) => [a.externalId, a.grund])).toEqual([
      ["p-3", "kunde_ausgelassen"],
      ["p-4", "projekt_unbekannt"],
    ]);
  });

  it("closes the months up to the one the old tool had closed, also on a second run", () => {
    const daten = mitZeiten(
      zeit("z-1", "2026-08-31", 420, 900),
      zeit("z-2", "2026-09-30", 420, 900, 0, 3),
      zeit("z-3", "2026-10-01", 420, 900, 0, 4),
    );
    const stempelungen = gespeichert("sandra", zeit("z-1", "2026-08-31", 420, 900));
    const vorhanden = { ...stand().vorhanden, stempelungen };
    const plan = planen(
      daten,
      ZUORDNUNG,
      "2026-09",
      stand({ vorhanden, geschlossen: () => new Set(["2026-07"]) }),
    );
    expect(plan.monate).toEqual([
      { nutzerId: "sandra", monat: "2026-08" },
      { nutzerId: "sandra", monat: "2026-09" },
    ]);
    const zu = planen(
      daten,
      ZUORDNUNG,
      "2026-09",
      stand({ geschlossen: () => new Set(["2026-08", "2026-09"]) }),
    );
    expect(zu.monate).toEqual([]);
  });

  it("closes no month whose records were all refused or left out", () => {
    const daten: ImportDaten = {
      ...mitZeiten(zeit("z-1", "2026-08-03", 420, 900), {
        ...zeit("z-2", "2026-09-01", 420, 900, 0, 3),
        person: "Leon",
      }),
      abwesenheiten: [
        {
          externalId: "a-1",
          zeile: 4,
          person: "Sandra Kühn",
          art: "Urlaub",
          von: "2026-07-06",
          bis: "2026-07-07",
        },
      ],
    };
    const vorhandene: Stempelung[] = [
      { art: "kommen", zeitpunkt: um("2026-08-03T06:00:00+02:00") },
      { art: "gehen", zeitpunkt: um("2026-08-03T16:00:00+02:00") },
    ];
    const plan = planen(
      daten,
      ZUORDNUNG,
      "2026-09",
      stand({
        stempelVon: () => vorhandene,
        abwesenheitenVon: () => [{ art: "urlaub", von: "2026-07-07", bis: "2026-07-07" }],
      }),
    );
    expect(plan.zahlen.zeiten).toMatchObject({ neu: 0, ausgelassen: 1, abgelehnt: 1 });
    expect(plan.zahlen.abwesenheiten.abgelehnt).toBe(1);
    expect(plan.monate).toEqual([]);
  });

  it("reports a record taken over for another person and closes no month for the new one", () => {
    const daten = mitZeiten(zeit("z-1", "2026-09-01", 420, 900));
    const stempelungen = gespeichert("max", zeit("z-1", "2026-09-01", 420, 900));
    const vorhanden = { ...stand().vorhanden, stempelungen };
    const plan = planen(daten, ZUORDNUNG, "2026-09", stand({ vorhanden }));
    expect(plan.zahlen.zeiten).toEqual({ neu: 0, vorhanden: 0, ausgelassen: 0, abgelehnt: 1 });
    expect(plan.abgelehnt).toEqual([
      { art: "zeiten", zeile: 2, externalId: "z-1", grund: "zuordnung_abweichend" },
    ]);
    expect(plan.monate).toEqual([]);
  });

  it("reports a record moved in the old tool and closes the month of the row in Soll only", () => {
    const stempelungen = gespeichert("sandra", zeit("z-1", "2026-08-03", 420, 900));
    const abwesenheiten = new Map([
      ["a-1", { nutzerId: "sandra", art: "urlaub" as const, von: "2026-08-03", bis: "2026-08-07" }],
    ]);
    const vorhanden = { ...stand().vorhanden, stempelungen, abwesenheiten };
    const verschoben: ImportDaten = {
      ...mitZeiten(zeit("z-1", "2026-09-03", 420, 900)),
      abwesenheiten: [
        {
          externalId: "a-1",
          zeile: 3,
          person: "Sandra Kühn",
          art: "Urlaub",
          von: "2026-08-03",
          bis: "2026-09-07",
        },
      ],
    };
    const plan = planen(verschoben, ZUORDNUNG, "2026-09", stand({ vorhanden }));
    expect(plan.abgelehnt.map((a) => [a.externalId, a.grund])).toEqual([
      ["z-1", "geaendert_im_alten_tool"],
      ["a-1", "geaendert_im_alten_tool"],
    ]);
    expect(plan.monate).toEqual([]);
    // a longer break is a change too; the same record again closes August, the month of its row
    const pause = planen(
      mitZeiten(zeit("z-1", "2026-08-03", 420, 900, 30)),
      ZUORDNUNG,
      "2026-09",
      stand({ vorhanden }),
    );
    expect(pause.abgelehnt.map((a) => a.grund)).toEqual(["geaendert_im_alten_tool"]);
    const gleich = planen(
      mitZeiten(zeit("z-1", "2026-08-03", 420, 900)),
      ZUORDNUNG,
      "2026-09",
      stand({ vorhanden }),
    );
    expect(gleich.zahlen.zeiten.vorhanden).toBe(1);
    expect(gleich.monate).toEqual([{ nutzerId: "sandra", monat: "2026-08" }]);
  });
});
