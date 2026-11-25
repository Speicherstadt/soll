import { type ImportSchicht, leer } from "@soll/import";
import { describe, expect, it } from "vitest";
import { planen } from "./plan.ts";
import { stand, um, ZUORDNUNG } from "./plan-testhilfen.ts";

/* The planned shifts of a shift planner in the plan of a takeover (BAULISTE.md S-706) */

const schicht = (id: string, von: string, bis: string, extra: Partial<ImportSchicht> = {}) => ({
  externalId: id,
  zeile: 2,
  person: "Sandra Kühn" as string | null,
  beginn: um(von),
  ende: um(bis),
  pauseMinuten: 30,
  rolle: "Montage",
  ...extra,
});

const MIT_STANDORT = { ...ZUORDNUNG, standort: "hafen" };
const mit = (...schichten: ImportSchicht[]) => ({ ...leer(), schichten });

const FRUEH = schicht("s-1", "2026-09-01T07:00:00+02:00", "2026-09-01T15:00:00+02:00");

describe("shifts in the plan of a takeover", () => {
  it("plans a draft at the chosen site, on the Berlin day it begins; an open one has no person", () => {
    const nacht = schicht("s-2", "2026-09-04T22:00:00+02:00", "2026-09-05T06:00:00+02:00", {
      person: null,
      zeile: 3,
    });
    const plan = planen(mit(FRUEH, nacht), MIT_STANDORT, null, stand());
    expect(plan.schichten).toEqual([
      {
        standortId: "hafen",
        tag: "2026-09-01",
        beginn: FRUEH.beginn,
        ende: FRUEH.ende,
        pauseMinuten: 30,
        rolle: "Montage",
        nutzerId: "sandra",
        externId: "s-1",
      },
      {
        standortId: "hafen",
        tag: "2026-09-04",
        beginn: nacht.beginn,
        ende: nacht.ende,
        pauseMinuten: 30,
        rolle: "Montage",
        nutzerId: null,
        externId: "s-2",
      },
    ]);
    expect(plan.zahlen.schichten).toEqual({ neu: 2, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 });
    // a shift is no record: it closes no month
    expect(planen(mit(FRUEH), MIT_STANDORT, "2026-10", stand()).monate).toEqual([]);
  });

  it("leaves shifts out without a site or a person, refuses them without the module", () => {
    expect(planen(mit(FRUEH), ZUORDNUNG, null, stand()).zahlen.schichten.ausgelassen).toBe(1);
    const ohnePerson = { ...MIT_STANDORT, personen: {} };
    expect(planen(mit(FRUEH), ohnePerson, null, stand()).zahlen.schichten.ausgelassen).toBe(1);
    const aus = planen(
      mit(FRUEH),
      MIT_STANDORT,
      null,
      stand({ module: { arbeitszeit: true, projektzeit: true, dienstplan: false } }),
    );
    expect(aus.abgelehnt).toEqual([
      { art: "schichten", zeile: 2, externalId: "s-1", grund: "modul_aus" },
    ]);
    const fremd = planen(mit(FRUEH), MIT_STANDORT, null, stand({ mitglieder: new Set() }));
    expect(fremd.abgelehnt.map((a) => a.grund)).toEqual(["person_unbekannt"]);
  });

  it("refuses a shift that overlaps one of the same person, in Soll or in the file", () => {
    const spaet = schicht("s-3", "2026-09-01T14:00:00+02:00", "2026-09-01T22:00:00+02:00", {
      zeile: 4,
    });
    const plan = planen(mit(FRUEH, spaet), MIT_STANDORT, null, stand());
    expect(plan.abgelehnt).toEqual([
      { art: "schichten", zeile: 4, externalId: "s-3", grund: "ueberschneidung" },
    ]);
    const belegt = stand({ schichtenVon: () => [{ beginn: FRUEH.beginn, ende: FRUEH.ende }] });
    expect(planen(mit(FRUEH), MIT_STANDORT, null, belegt).abgelehnt[0]?.grund).toBe(
      "ueberschneidung",
    );
  });

  it("finds a shift taken over before, and names one the old tool changed since", () => {
    const vorhanden = (aenderung: object = {}) =>
      stand({
        vorhanden: {
          ...stand().vorhanden,
          schichten: new Map([
            [
              "s-1",
              {
                nutzerId: "sandra",
                beginn: FRUEH.beginn,
                ende: FRUEH.ende,
                pauseMinuten: 30,
                rolle: "Montage",
                ...aenderung,
              },
            ],
          ]),
        },
        // the shift itself is in the plan now and must not count as an overlap
        schichtenVon: () => [{ beginn: FRUEH.beginn, ende: FRUEH.ende }],
      });
    const wieder = planen(mit(FRUEH), MIT_STANDORT, null, vorhanden());
    expect(wieder.zahlen.schichten).toEqual({ neu: 0, vorhanden: 1, ausgelassen: 0, abgelehnt: 0 });
    expect(wieder.schichten).toEqual([]);
    const verschoben = planen(mit(FRUEH), MIT_STANDORT, null, vorhanden({ ende: FRUEH.ende + 1 }));
    expect(verschoben.abgelehnt[0]?.grund).toBe("geaendert_im_alten_tool");
    const anders = planen(mit(FRUEH), MIT_STANDORT, null, vorhanden({ nutzerId: "max" }));
    expect(anders.abgelehnt[0]?.grund).toBe("zuordnung_abweichend");
  });
});
