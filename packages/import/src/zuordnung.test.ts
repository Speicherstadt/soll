import { describe, expect, it } from "vitest";
import { leer } from "./modell.ts";
import { artenAus, artVorschlag, personenAus, personVorschlag, vorschlag } from "./zuordnung.ts";

const WEBER = [
  { nutzerId: "jonas", name: "Jonas Weber" },
  { nutzerId: "sandra", name: "Sandra Kühn" },
  { nutzerId: "max", name: "Max Brandt" },
  { nutzerId: "max2", name: "Max Brandt" },
];

describe("proposals for the mapping", () => {
  it("proposes the member of the same name, also written as last name first", () => {
    expect(personVorschlag("Sandra Kühn", WEBER)).toBe("sandra");
    expect(personVorschlag("sandra kuehn", WEBER)).toBeNull();
    expect(personVorschlag("SANDRA KÜHN", WEBER)).toBe("sandra");
    expect(personVorschlag("Weber, Jonas", WEBER)).toBe("jonas");
    expect(personVorschlag("Leon Albers", WEBER)).toBeNull();
  });

  it("proposes nobody when two members share the name: the owner decides", () => {
    expect(personVorschlag("Max Brandt", WEBER)).toBeNull();
  });

  it("proposes a kind of absence from German and English words", () => {
    expect(artVorschlag("Urlaub")).toBe("urlaub");
    expect(artVorschlag("Vacation")).toBe("urlaub");
    expect(artVorschlag("Krankheit")).toBe("krank");
    expect(artVorschlag("sick leave")).toBe("krank");
    expect(artVorschlag("Kind krank")).toBe("kind_krank");
    expect(artVorschlag("Überstundenabbau")).toBe("ueberstundenabbau");
    expect(artVorschlag("Sonderurlaub")).toBe("sonderurlaub");
    expect(artVorschlag("Elternzeit")).toBeNull();
  });

  it("lists the persons and kinds of a file once, with how many records name them", () => {
    const daten = leer();
    daten.zeiten.push(
      {
        externalId: "1",
        zeile: 2,
        person: "Sandra",
        tag: "2026-09-01",
        beginn: 0,
        ende: 60,
        pauseMinuten: 0,
      },
      {
        externalId: "2",
        zeile: 3,
        person: "Max",
        tag: "2026-09-01",
        beginn: 0,
        ende: 60,
        pauseMinuten: 0,
      },
    );
    daten.abwesenheiten.push(
      {
        externalId: "a",
        zeile: 4,
        person: "Sandra",
        art: "Urlaub",
        von: "2026-09-02",
        bis: "2026-09-02",
      },
      {
        externalId: "b",
        zeile: 5,
        person: "Sandra",
        art: "Urlaub",
        von: "2026-09-03",
        bis: "2026-09-03",
      },
    );
    expect(personenAus(daten)).toEqual([
      { person: "Max", datensaetze: 1 },
      { person: "Sandra", datensaetze: 3 },
    ]);
    expect(artenAus(daten)).toEqual([{ art: "Urlaub", datensaetze: 2 }]);
    expect(vorschlag(daten, [{ nutzerId: "s", name: "Sandra" }])).toEqual({
      personen: { Max: null, Sandra: "s" },
      arten: { Urlaub: "urlaub" },
      kunden: {},
      projekte: {},
      taetigkeiten: {},
    });
  });
});
