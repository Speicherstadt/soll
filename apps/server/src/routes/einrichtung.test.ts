import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { testServer } from "../test-server.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

const CAFE = { beschaeftigte: true, schichten: true, kunden: false, stempelort: false };
const FREELANCER = { beschaeftigte: false, schichten: false, kunden: true, stempelort: false };

type Person = ReturnType<ReturnType<typeof testServer>["browser"]>;

const einrichten = (p: Person, body: unknown) =>
  p.anfrage("/api/v1/einrichtung/betrieb", { method: "PUT", body });

describe("PUT /api/v1/einrichtung/betrieb", () => {
  it("sets name, Land and the modules of the four questions, all in the chain", async () => {
    const server = testServer();
    const mia = await server.inhaberMitBetrieb("Elbblick", "elbblick");
    const antwort = await einrichten(mia, { name: "Café Elbblick", land: "HH", fragen: CAFE });
    expect(antwort.status).toBe(200);
    expect(await json(await mia.anfrage("/api/v1/betrieb"))).toEqual({
      betriebId: mia.betriebId,
      nutzerId: mia.nutzerId,
      name: "Café Elbblick",
      land: "HH",
      eingerichtet: false,
      rolle: "inhaber",
      module: { arbeitszeit: true, dienstplan: true, projektzeit: false, terminal: false },
    });
    expect(kettePruefen(server.db, mia.betriebId)).toEqual([]);
  });

  it("a freelancer without employees gets project time only", async () => {
    const server = testServer();
    const solo = await server.inhaberMitBetrieb("Solo", "solo");
    await einrichten(solo, { name: "Lina Petersen Design", land: "SH", fragen: FREELANCER });
    expect((await json(await solo.anfrage("/api/v1/betrieb"))).module).toEqual({
      arbeitszeit: false,
      dienstplan: false,
      projektzeit: true,
      terminal: false,
    });
  });

  it("keeps working time while the business has employees (BAG 1 ABR 22/21)", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await server.eingeladen(weber, "mitarbeiter", "sandra");
    const antwort = await einrichten(weber, { name: "Weber", land: "HH", fragen: FREELANCER });
    expect(antwort.status).toBe(409);
    expect(await json(antwort)).toEqual({ fehler: "arbeitszeit_pflicht" });
    expect((await json(await weber.anfrage("/api/v1/betrieb"))).name).toBe("Weber Haustechnik");
  });

  it("refuses an unknown Land, an empty name and missing answers", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    for (const body of [
      { name: "Weber", land: "XX", fragen: CAFE },
      { name: " ", land: "HH", fragen: CAFE },
      { name: "Weber", land: "HH", fragen: { beschaeftigte: true } },
    ])
      expect((await einrichten(weber, body)).status).toBe(400);
  });

  it("is for the owner only", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const anna = await server.eingeladen(weber, "planer", "anna");
    expect((await einrichten(anna, { name: "Anna", land: "HH", fragen: CAFE })).status).toBe(403);
    expect(
      (await anna.anfrage("/api/v1/einrichtung/abschliessen", { method: "POST", body: {} })).status,
    ).toBe(403);
  });
});

describe("POST /api/v1/einrichtung/abschliessen", () => {
  it("marks the setup as done once, at the time it was first finished", async () => {
    const server = testServer();
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    await mia.anfrage("/api/v1/einrichtung/abschliessen", { method: "POST", body: {} });
    server.stelleUhr(1_790_000_100_000);
    await mia.anfrage("/api/v1/einrichtung/abschliessen", { method: "POST", body: {} });
    expect((await json(await mia.anfrage("/api/v1/betrieb"))).eingerichtet).toBe(true);
    expect(
      server.sqlite
        .query("SELECT eingerichtet_am FROM betriebe WHERE betrieb_id = ?")
        .get(mia.betriebId),
    ).toEqual({ eingerichtet_am: 1_790_000_000_000 });
  });
});

describe("/api/v1/standorte", () => {
  it("adds, lists and removes the sites of the business, with Land and regions", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const neu = await weber.anfrage("/api/v1/standorte", {
      body: { name: "Werkstatt", adresse: "Hafenstraße 12, 20459 Hamburg", land: "HH" },
    });
    expect(neu.status).toBe(201);
    server.stelleUhr(1_790_000_060_000);
    const augsburg = await json(
      await weber.anfrage("/api/v1/standorte", {
        body: { name: "Baustelle Augsburg", land: "BY", regionen: ["augsburg", "katholisch"] },
      }),
    );
    const liste = (await json(await weber.anfrage("/api/v1/standorte"))).standorte as unknown[];
    expect(liste).toEqual([
      expect.objectContaining({
        name: "Werkstatt",
        adresse: "Hafenstraße 12, 20459 Hamburg",
        land: "HH",
        regionen: [],
      }),
      expect.objectContaining({
        name: "Baustelle Augsburg",
        land: "BY",
        regionen: ["augsburg", "katholisch"],
      }),
    ]);
    const weg = await weber.anfrage(`/api/v1/standorte/${augsburg.standortId}`, {
      method: "DELETE",
    });
    expect(weg.status).toBe(204);
    expect((await json(await weber.anfrage("/api/v1/standorte"))).standorte).toHaveLength(1);
    expect(kettePruefen(server.db, weber.betriebId)).toEqual([]);
  });

  it("refuses a region of another Land and an unknown region", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    for (const regionen of [["augsburg"], ["hamburg_nord"]])
      expect(
        (
          await weber.anfrage("/api/v1/standorte", {
            body: { name: "Werkstatt", land: "HH", regionen },
          })
        ).status,
      ).toBe(400);
  });

  it("lets employees read the sites but only the owner change them", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await weber.anfrage("/api/v1/standorte", { body: { name: "Werkstatt", land: "HH" } });
    const max = await server.eingeladen(weber, "mitarbeiter", "max");
    expect((await json(await max.anfrage("/api/v1/standorte"))).standorte).toHaveLength(1);
    expect(
      (await max.anfrage("/api/v1/standorte", { body: { name: "Lager", land: "HH" } })).status,
    ).toBe(403);
  });
});
