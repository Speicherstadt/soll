import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";
import { testGeraet } from "./geraet-test-hilfen.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;
const JETZT = Date.parse("2026-11-20T09:00:00+01:00");
const GESTERN = Date.parse("2026-11-19T07:00:00+01:00");

/** Two businesses: Weber with Sandra, Café Elbblick with Tom, each with a stamp and a model */
const zwei = async () => {
  const server = testServer();
  server.stelleUhr(JETZT);
  const jonas = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  const sandra = await server.eingeladen(jonas, "mitarbeiter", "sandra");
  const tom = await server.eingeladen(mia, "mitarbeiter", "tom");
  const stempel = await json(
    await sandra.anfrage("/api/v1/arbeitszeit/stempelungen/nachtrag", {
      body: { art: "kommen", zeitpunkt: GESTERN, grund: "vergessen" },
    }),
  );
  const modell = await json(
    await jonas.anfrage("/api/v1/arbeitszeit/modelle", {
      body: {
        name: "Vollzeit",
        sollMinuten: [480, 480, 480, 480, 480, 0, 0],
        lohnArt: "monat",
        lohnCent: null,
        minijob: false,
      },
    }),
  );
  return { server, jonas, mia, sandra, tom, stempel, modell };
};

const anzahl = (server: ReturnType<typeof testServer>) =>
  server.sqlite.query("SELECT COUNT(*) AS n FROM stempelungen").get();

describe("no business sees or changes another's times", () => {
  it("GET /api/v1/arbeitszeit/tag does not show a person of another business", async () => {
    const { mia, sandra } = await zwei();
    const antwort = await mia.anfrage(
      `/api/v1/arbeitszeit/tag?datum=2026-11-19&nutzerId=${sandra.nutzerId}`,
    );
    expect(antwort.status).toBe(404);
    const eigen = await json(await mia.anfrage("/api/v1/arbeitszeit/tag?datum=2026-11-19"));
    expect(eigen.stempelungen).toEqual([]);
  });

  it("POST /api/v1/arbeitszeit/stempelungen writes into one's own business only", async () => {
    const { server, tom, mia } = await zwei();
    await tom.anfrage("/api/v1/arbeitszeit/stempelungen", { body: { art: "kommen" } });
    expect(
      server.sqlite
        .query("SELECT betrieb_id FROM stempelungen WHERE nutzer_id = ?")
        .all(tom.nutzerId),
    ).toEqual([{ betrieb_id: mia.betriebId }]);
  });

  it("POST /api/v1/arbeitszeit/stempelungen/nachtrag does not reach a person of another business", async () => {
    const { server, mia, sandra } = await zwei();
    const vorher = anzahl(server);
    const antwort = await mia.anfrage("/api/v1/arbeitszeit/stempelungen/nachtrag", {
      body: { nutzerId: sandra.nutzerId, art: "gehen", zeitpunkt: GESTERN + 3_600_000, grund: "x" },
    });
    expect(antwort.status).toBe(404);
    expect(anzahl(server)).toEqual(vorher);
  });

  it("PATCH /api/v1/arbeitszeit/stempelungen/:id does not reach another's stamp", async () => {
    const { server, mia, stempel } = await zwei();
    const vorher = anzahl(server);
    const antwort = await mia.anfrage(`/api/v1/arbeitszeit/stempelungen/${stempel.stempelId}`, {
      method: "PATCH",
      body: { art: "kommen", zeitpunkt: GESTERN - 3_600_000, grund: "x" },
    });
    expect(antwort.status).toBe(404);
    expect(anzahl(server)).toEqual(vorher);
  });

  it("POST /api/v1/arbeitszeit/stempelungen/:id/entfernen does not reach another's stamp", async () => {
    const { server, tom, stempel } = await zwei();
    const vorher = anzahl(server);
    const antwort = await tom.anfrage(
      `/api/v1/arbeitszeit/stempelungen/${stempel.stempelId}/entfernen`,
      {
        body: { grund: "x" },
      },
    );
    expect(antwort.status).toBe(404);
    expect(anzahl(server)).toEqual(vorher);
  });

  it("GET /api/v1/arbeitszeit/personen lists one's own people only", async () => {
    const { mia } = await zwei();
    const personen = (await json(await mia.anfrage("/api/v1/arbeitszeit/personen"))).personen;
    expect((personen as { name: string }[]).map((p) => p.name).sort()).toEqual([
      "Inhaber Café Elbblick",
      "tom",
    ]);
  });

  it("PUT /api/v1/arbeitszeit/personen/:id/modell reaches neither another's person nor model", async () => {
    const { server, mia, sandra, tom, modell } = await zwei();
    const fremdePerson = await mia.anfrage(
      `/api/v1/arbeitszeit/personen/${sandra.nutzerId}/modell`,
      {
        method: "PUT",
        body: { modellId: modell.modellId },
      },
    );
    expect(fremdePerson.status).toBe(404);
    const fremdesModell = await mia.anfrage(`/api/v1/arbeitszeit/personen/${tom.nutzerId}/modell`, {
      method: "PUT",
      body: { modellId: modell.modellId },
    });
    expect(fremdesModell.status).toBe(404);
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM modellzuordnungen").get()).toEqual({
      n: 0,
    });
  });

  it("PUT /api/v1/arbeitszeit/geraete/:id keeps devices of the same id apart per business", async () => {
    const { server, sandra, tom } = await zwei();
    const geraet = await testGeraet();
    const pfad = `/api/v1/arbeitszeit/geraete/${geraet.geraetId}`;
    const body = { schluessel: geraet.schluessel };
    expect((await sandra.anfrage(pfad, { method: "PUT", body })).status).toBe(201);
    // the same id in another business is another device: it neither takes nor changes Sandra's
    expect((await tom.anfrage(pfad, { method: "PUT", body })).status).toBe(201);
    expect(server.sqlite.query("SELECT nutzer_id FROM geraete ORDER BY nutzer_id").all()).toEqual(
      [sandra.nutzerId, tom.nutzerId].sort().map((nutzer_id) => ({ nutzer_id })),
    );
  });

  it("POST /api/v1/arbeitszeit/stempelungen/offline does not take an entry of another business's device", async () => {
    const { server, sandra, tom } = await zwei();
    const geraet = await testGeraet();
    await sandra.anfrage(`/api/v1/arbeitszeit/geraete/${geraet.geraetId}`, {
      method: "PUT",
      body: { schluessel: geraet.schluessel },
    });
    const vorher = anzahl(server);
    const antwort = await tom.anfrage("/api/v1/arbeitszeit/stempelungen/offline", {
      body: await geraet.offline(1, "kommen", JETZT - 60_000, JETZT),
    });
    expect(antwort.status).toBe(404);
    expect(anzahl(server)).toEqual(vorher);
  });

  it("GET /api/v1/arbeitszeit/tag shows no gap of another business's devices", async () => {
    const { mia, sandra } = await zwei();
    const geraet = await testGeraet();
    await sandra.anfrage(`/api/v1/arbeitszeit/geraete/${geraet.geraetId}`, {
      method: "PUT",
      body: { schluessel: geraet.schluessel },
    });
    await sandra.anfrage("/api/v1/arbeitszeit/stempelungen/offline", {
      body: await geraet.offline(3, "kommen", JETZT - 60_000, JETZT),
    });
    const eigen = await json(await sandra.anfrage("/api/v1/arbeitszeit/tag"));
    expect(eigen.luecken).toEqual([{ geraetId: geraet.geraetId, von: 1, bis: 2 }]);
    const fremd = await mia.anfrage(`/api/v1/arbeitszeit/tag?nutzerId=${sandra.nutzerId}`);
    expect(fremd.status).toBe(404);
    expect((await json(await mia.anfrage("/api/v1/arbeitszeit/tag"))).luecken).toEqual([]);
  });
});
