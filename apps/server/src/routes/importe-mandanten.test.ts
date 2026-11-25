import { describe, expect, it } from "vitest";
import {
  IMP,
  koerper,
  uebernehmen,
  vorschauVon,
  weberZumUmzug,
  zuordnungFuer,
} from "./importe-testhilfen.ts";
import { json, mitProjektzeit } from "./projektzeit-testhilfen.ts";

/** Weber has taken an import over; Café Elbblick with Tom is in the same instance */
const zweiBetriebe = async () => {
  const w = await weberZumUmzug();
  const ergebnis = await uebernehmen(
    w.weber,
    koerper(zuordnungFuer(w.sandra.nutzerId, w.max.nutzerId)),
  );
  const mia = await mitProjektzeit(w.server, "Café Elbblick", "elbblick");
  const tom = await w.server.eingeladen(mia, "mitarbeiter", "tom");
  const kunden = (await json(await w.weber.anfrage("/api/v1/projektzeit/kunden"))).kunden as {
    kundeId: string;
  }[];
  const projekte = (await json(await w.weber.anfrage("/api/v1/projektzeit/projekte"))).projekte as {
    projektId: string;
  }[];
  return { ...w, ergebnis, mia, tom, kunden, projekte };
};

describe("imports per business (S-701)", () => {
  it("lists and hands out only the business's own imports and files", async () => {
    const { mia, ergebnis } = await zweiBetriebe();
    expect(await json(await mia.anfrage(IMP))).toEqual({ importe: [] });
    expect((await mia.anfrage(`${IMP}/${ergebnis.importId}/datei`)).status).toBe(404);
  });

  it("proposes and shows only the business's own members, customers and orders", async () => {
    const { mia, tom } = await zweiBetriebe();
    const vorschau = await json(await vorschauVon(mia));
    expect(new Set((vorschau.mitglieder as { nutzerId: string }[]).map((m) => m.nutzerId))).toEqual(
      new Set([mia.nutzerId, tom.nutzerId]),
    );
    expect(vorschau.vorhandeneKunden).toEqual([]);
    expect(vorschau.vorhandeneProjekte).toEqual([]);
  });

  it("refuses a mapping to a person, customer or order of another business", async () => {
    const { mia, tom, sandra, kunden, projekte } = await zweiBetriebe();
    const fremd = async (zuordnung: unknown, fehler: string) => {
      for (const pfad of [IMP, `${IMP}/probelauf`]) {
        const antwort = await mia.anfrage(pfad, { body: koerper(zuordnung) });
        expect(antwort.status).toBe(422);
        expect(await antwort.json()).toEqual({ fehler });
      }
    };
    await fremd(zuordnungFuer(sandra.nutzerId, tom.nutzerId), "person_unbekannt");
    await fremd(
      {
        ...zuordnungFuer(tom.nutzerId, tom.nutzerId),
        kunden: { "k-1": { id: kunden[0]?.kundeId } },
      },
      "kunde_unbekannt",
    );
    await fremd(
      {
        ...zuordnungFuer(tom.nutzerId, tom.nutzerId),
        projekte: { "p-1": { id: projekte[0]?.projektId } },
      },
      "projekt_unbekannt",
    );
  });

  it("takes the same file over in another business without finding the first one's rows", async () => {
    const { mia, tom } = await zweiBetriebe();
    const ergebnis = await uebernehmen(
      mia,
      koerper({ ...zuordnungFuer(tom.nutzerId, tom.nutzerId), personen: { Sandra: tom.nutzerId } }),
    );
    expect(ergebnis.zahlen).toMatchObject({
      zeiten: { neu: 2, vorhanden: 0 },
      kunden: { neu: 1, vorhanden: 0 },
    });
  });
});
