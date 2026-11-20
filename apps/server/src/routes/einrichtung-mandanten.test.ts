import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

const zwei = async () => {
  const server = testServer();
  const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  return { server, weber, mia };
};

const FRAGEN = { beschaeftigte: true, schichten: false, kunden: true, stempelort: true };

describe("no business sees or changes another's setup", () => {
  it("PUT /api/v1/einrichtung/betrieb changes one's own business only", async () => {
    const { weber, mia } = await zwei();
    await weber.anfrage("/api/v1/einrichtung/betrieb", {
      method: "PUT",
      body: { name: "Weber GmbH", land: "SH", fragen: FRAGEN },
    });
    expect(await json(await mia.anfrage("/api/v1/betrieb"))).toMatchObject({
      name: "Café Elbblick",
      land: null,
      module: { arbeitszeit: true, dienstplan: false, projektzeit: false, terminal: false },
    });
  });

  it("POST /api/v1/einrichtung/abschliessen finishes one's own setup only", async () => {
    const { weber, mia } = await zwei();
    await weber.anfrage("/api/v1/einrichtung/abschliessen", { method: "POST", body: {} });
    expect((await json(await mia.anfrage("/api/v1/betrieb"))).eingerichtet).toBe(false);
  });

  it("GET /api/v1/standorte lists one's own sites only", async () => {
    const { weber, mia } = await zwei();
    await weber.anfrage("/api/v1/standorte", { body: { name: "Werkstatt", land: "HH" } });
    expect((await json(await mia.anfrage("/api/v1/standorte"))).standorte).toEqual([]);
  });

  it("POST /api/v1/standorte writes into one's own business, whatever the body says", async () => {
    const { weber, mia } = await zwei();
    await mia.anfrage("/api/v1/standorte", {
      body: { name: "Café", land: "HH", betriebId: weber.betriebId },
    });
    expect((await json(await weber.anfrage("/api/v1/standorte"))).standorte).toEqual([]);
  });

  it("DELETE /api/v1/standorte/:id does not reach another's site", async () => {
    const { weber, mia } = await zwei();
    const werkstatt = await json(
      await weber.anfrage("/api/v1/standorte", { body: { name: "Werkstatt", land: "HH" } }),
    );
    const antwort = await mia.anfrage(`/api/v1/standorte/${werkstatt.standortId}`, {
      method: "DELETE",
    });
    expect(antwort.status).toBe(404);
    expect((await json(await weber.anfrage("/api/v1/standorte"))).standorte).toHaveLength(1);
  });

  it("POST /api/v1/einladungen/liste invites into one's own business only", async () => {
    const { server, weber, mia } = await zwei();
    await mia.anfrage("/api/v1/einladungen/liste", {
      body: { personen: [{ name: "Tom", rolle: "mitarbeiter" }] },
    });
    expect(server.sqlite.query("SELECT betrieb_id FROM einladungen").all()).toEqual([
      { betrieb_id: mia.betriebId },
    ]);
    expect(weber.betriebId).not.toBe(mia.betriebId);
  });
});
