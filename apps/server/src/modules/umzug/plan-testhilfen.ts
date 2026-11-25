import type { Stempelung } from "@soll/arbeitszeit";
import { type ImportDaten, type ImportZeit, leer, type Zuordnung } from "@soll/import";
import type { Stand } from "./plan-typen.ts";
import { stempelAus, stempelKennung } from "./plan-zeiten.ts";

/* Helpers for the tests of the plan of a takeover (S-701, S-702) */

// Instants in Berlin: winter time +01:00, summer time +02:00
export const um = (text: string) => Date.parse(text);

export const zeit = (
  id: string,
  tag: string,
  beginn: number,
  ende: number,
  pause = 0,
  zeile = 2,
) => ({
  externalId: id,
  zeile,
  person: "Sandra Kühn",
  tag,
  beginn,
  ende,
  pauseMinuten: pause,
});

/** The stamps an earlier import wrote for a span, by their ids, as `uebernommeneKennungen` reads them */
export const gespeichert = (nutzerId: string, ...zeiten: ImportZeit[]) =>
  new Map(
    zeiten.flatMap((z) =>
      (stempelAus(z) as Stempelung[]).map(
        (s) => [stempelKennung(z.externalId, s.art), { nutzerId, zeitpunkt: s.zeitpunkt }] as const,
      ),
    ),
  );

export const stand = (aenderung: Partial<Stand> = {}): Stand => {
  let n = 0;
  return {
    jetzt: um("2026-11-25T12:00:00+01:00"),
    module: { arbeitszeit: true, projektzeit: true, dienstplan: true },
    mitglieder: new Set(["sandra", "max"]),
    vorhanden: {
      stempelungen: new Map(),
      abwesenheiten: new Map(),
      kunden: new Map(),
      projekte: new Set(),
      taetigkeiten: new Map(),
      buchungen: new Set(),
      salden: new Map(),
      schichten: new Map(),
    },
    saldoPruefen: () => null,
    buchungUeberschneidet: () => false,
    kunden: new Set(["elbhof"]),
    projekte: new Set(["bad"]),
    taetigkeiten: new Set(["montage"]),
    geschlossen: () => new Set(),
    stempelVon: () => [],
    stempelGesperrt: () => false,
    schichtenVon: () => [],
    abwesenheitenVon: () => [],
    abwesenheitGesperrt: () => false,
    neueId: () => `id-${++n}`,
    ...aenderung,
  };
};

export const ZUORDNUNG: Zuordnung = {
  personen: { "Sandra Kühn": "sandra", "Max Brandt": "max" },
  arten: { Urlaub: "urlaub", Krank: "krank" },
  kunden: {},
  projekte: {},
  taetigkeiten: {},
};

export const mitZeiten = (...zeiten: ImportDaten["zeiten"]): ImportDaten => ({ ...leer(), zeiten });
