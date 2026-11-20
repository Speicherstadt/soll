import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { testServer } from "../test-server.ts";

/**
 * A business without employees (BAULISTE.md S-603): project time only, until the first employed
 * person joins; then Soll switches working time on and tells the owner why.
 */

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

const FREELANCER = { beschaeftigte: false, schichten: false, kunden: true, stempelort: false };

/** Lina alone with her design studio, set up through the four questions */
const solo = async () => {
  const server = testServer();
  const lina = await server.inhaberMitBetrieb("Lina Petersen Design", "lina");
  await lina.anfrage("/api/v1/einrichtung/betrieb", {
    method: "PUT",
    body: { name: "Lina Petersen Design", land: "HH", fragen: FREELANCER },
  });
  await lina.anfrage("/api/v1/einrichtung/abschliessen", { body: {} });
  return { server, lina };
};

const betrieb = async (person: { anfrage: (pfad: string) => Promise<Response> }) =>
  json(await person.anfrage("/api/v1/betrieb"));

describe("a business without employees", () => {
  it("has project time only, no working time check and no notice", async () => {
    const { lina } = await solo();
    expect(await betrieb(lina)).toMatchObject({
      module: { arbeitszeit: false, dienstplan: false, projektzeit: true, terminal: false },
      hinweis: null,
    });
    // no day, month or reminder of the working time check reaches the owner alone
    for (const pfad of [
      "/api/v1/arbeitszeit/tag",
      "/api/v1/arbeitszeit/monat",
      "/api/v1/arbeitszeit/erinnerungen",
    ]) {
      const antwort = await lina.anfrage(pfad);
      expect(antwort.status, pfad).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "arbeitszeit" });
    }
    expect((await lina.anfrage("/api/v1/projektzeit/kunden")).status).toBe(200);
  });

  it("stays without working time while only an external person joins", async () => {
    const { server, lina } = await solo();
    await server.eingeladen(lina, "extern", "steuerberater");
    expect(await betrieb(lina)).toMatchObject({ module: { arbeitszeit: false }, hinweis: null });
  });

  it("switches working time on when the first employed person joins, and tells the owner why", async () => {
    const { server, lina } = await solo();
    // the invitation alone changes nothing: the duty begins with the employment
    await lina.anfrage("/api/v1/einladungen", { body: { rolle: "mitarbeiter", name: "Ole" } });
    expect(await betrieb(lina)).toMatchObject({ module: { arbeitszeit: false }, hinweis: null });
    const zeit = 1_790_000_000_000;
    const ole = await server.eingeladen(lina, "mitarbeiter", "ole");
    expect(await betrieb(lina)).toMatchObject({
      module: { arbeitszeit: true, projektzeit: true },
      hinweis: { art: "arbeitszeit_eingeschaltet", am: zeit },
    });
    // the notice is the owner's: the employee sees working time, not the notice
    expect(await betrieb(ole)).toMatchObject({ module: { arbeitszeit: true }, hinweis: null });
    expect((await ole.anfrage("/api/v1/arbeitszeit/tag")).status).toBe(200);
    // and it cannot be switched off again
    const aus = await lina.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { arbeitszeit: false },
    });
    expect(aus.status).toBe(409);
    expect(await json(aus)).toEqual({ fehler: "arbeitszeit_pflicht" });
    expect(kettePruefen(server.db, lina.betriebId)).toEqual([]);
  });

  it("keeps the notice until the owner confirms it, and only the owner can", async () => {
    const { server, lina } = await solo();
    const ole = await server.eingeladen(lina, "mitarbeiter", "ole");
    const vonOle = await ole.anfrage("/api/v1/betrieb/hinweis", { method: "DELETE" });
    expect(vonOle.status).toBe(403);
    expect((await betrieb(lina)).hinweis).toMatchObject({ art: "arbeitszeit_eingeschaltet" });
    const gelesen = await lina.anfrage("/api/v1/betrieb/hinweis", { method: "DELETE" });
    expect(gelesen.status).toBe(204);
    expect(await betrieb(lina)).toMatchObject({ module: { arbeitszeit: true }, hinweis: null });
    // confirming twice is no error
    expect((await lina.anfrage("/api/v1/betrieb/hinweis", { method: "DELETE" })).status).toBe(204);
    expect(kettePruefen(server.db, lina.betriebId)).toEqual([]);
  });

  it("gives no notice to a business that had working time on all along", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await server.eingeladen(weber, "mitarbeiter", "sandra");
    expect(await betrieb(weber)).toMatchObject({ module: { arbeitszeit: true }, hinweis: null });
  });

  it("shows no other business the notice", async () => {
    const { server, lina } = await solo();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await server.eingeladen(lina, "mitarbeiter", "ole");
    expect((await betrieb(weber)).hinweis).toBeNull();
    expect((await weber.anfrage("/api/v1/betrieb/hinweis", { method: "DELETE" })).status).toBe(204);
    expect((await betrieb(lina)).hinweis).toMatchObject({ art: "arbeitszeit_eingeschaltet" });
  });
});
