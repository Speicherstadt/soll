import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";
import { elbblick, json, schichtVon } from "./dienstplan-testhilfen.ts";

const ANGABEN = {
  geburtsdatum: "2009-06-01",
  wechselschicht: true,
  abruf: true,
  mutterschutz: [{ von: "2026-11-01", bis: null }],
};

/** Café Elbblick and Weber Haustechnik on one server */
const zweiBetriebe = async () => {
  const server = testServer();
  const elbe = await elbblick(server);
  const jonas = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  return { ...elbe, jonas };
};

describe("no business sees or changes another's data of a person or settings (S-502)", () => {
  it("GET and PUT angaben do not reach a person of another business", async () => {
    const { mia, jonas, tom } = await zweiBetriebe();
    const pfad = `/api/v1/personen/${tom.nutzerId}/angaben`;
    await mia.anfrage(pfad, { method: "PUT", body: ANGABEN });
    expect((await jonas.anfrage(pfad)).status).toBe(404);
    const fremd = await jonas.anfrage(pfad, {
      method: "PUT",
      body: { ...ANGABEN, geburtsdatum: null },
    });
    expect(fremd.status).toBe(404);
    expect(await json(await mia.anfrage(pfad))).toEqual(ANGABEN);
  });

  it("GET and PUT pruefung change only one's own business", async () => {
    const { mia, jonas } = await zweiBetriebe();
    await jonas.anfrage("/api/v1/betrieb/pruefung", {
      method: "PUT",
      body: {
        branche: "verkehr",
        sonntagsausnahme: 10,
        ausgleichszeitraum: "24_wochen",
        ausgleichBeginn: "2026-09-01",
      },
    });
    expect(await json(await mia.anfrage("/api/v1/betrieb/pruefung"))).toEqual({
      branche: null,
      sonntagsausnahme: null,
      ausgleichszeitraum: null,
      ausgleichBeginn: null,
    });
  });

  it("another business cannot set data that would change one's findings", async () => {
    const { lea, jonas, tom, standortId } = await zweiBetriebe();
    const versuch = await jonas.anfrage(`/api/v1/personen/${tom.nutzerId}/angaben`, {
      method: "PUT",
      body: ANGABEN,
    });
    expect(versuch.status).toBe(404);
    await lea.anfrage("/api/v1/dienstplan/schichten", {
      body: { ...schichtVon(standortId, tom.nutzerId, "2026-11-24"), endeMinute: 23 * 60 },
    });
    const woche = await json(
      await lea.anfrage(`/api/v1/dienstplan/woche?standortId=${standortId}&tag=2026-11-24`),
    );
    const regeln = (woche.befunde as { regel: string }[]).map((b) => b.regel);
    expect(regeln).not.toContain("R-15");
    expect(regeln).not.toContain("R-21");
  });

  it("a business without the module Dienstplan has no week and so no findings", async () => {
    const { mia, standortId } = await zweiBetriebe();
    await mia.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: false } });
    const antwort = await mia.anfrage(`/api/v1/dienstplan/woche?standortId=${standortId}`);
    expect(antwort.status).toBe(403);
  });
});
