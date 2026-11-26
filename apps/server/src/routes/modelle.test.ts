import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { testServer } from "../test-server.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

const VOLLZEIT = {
  name: "Vollzeit",
  sollMinuten: [480, 480, 480, 480, 480, 0, 0],
  lohnArt: "monat",
  lohnCent: 320_000,
  minijob: false,
};
const MINIJOB = {
  name: "Minijob",
  sollMinuten: [0, 0, 0, 0, 0, 0, 0],
  lohnArt: "stunde",
  lohnCent: null,
  minijob: true,
};

describe("/api/v1/arbeitszeit/modelle", () => {
  it("adds, lists and removes working-time models in whole minutes and cents", async () => {
    const server = testServer();
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    const neu = await mia.anfrage("/api/v1/arbeitszeit/modelle", { body: VOLLZEIT });
    expect(neu.status).toBe(201);
    const modell = await json(neu);
    // the day in Europe/Berlin of the test clock (1_790_000_000_000 is 2026-09-21)
    expect(modell).toMatchObject({ ...VOLLZEIT, gueltigAb: "2026-09-21" });
    server.stelleUhr(1_790_000_060_000);
    await mia.anfrage("/api/v1/arbeitszeit/modelle", {
      body: { ...MINIJOB, gueltigAb: "2026-10-01" },
    });
    const liste = (await json(await mia.anfrage("/api/v1/arbeitszeit/modelle"))).modelle;
    expect(liste).toEqual([
      expect.objectContaining({ name: "Vollzeit", lohnCent: 320_000 }),
      expect.objectContaining({
        name: "Minijob",
        lohnCent: null,
        minijob: true,
        gueltigAb: "2026-10-01",
      }),
    ]);
    const weg = await mia.anfrage(`/api/v1/arbeitszeit/modelle/${modell.modellId}`, {
      method: "DELETE",
    });
    expect(weg.status).toBe(204);
    expect((await json(await mia.anfrage("/api/v1/arbeitszeit/modelle"))).modelle).toHaveLength(1);
    expect(kettePruefen(server.db, mia.betriebId)).toEqual([]);
  });

  it("refuses fractions of minutes and cents, a day over 24 hours and a week without seven days", async () => {
    const server = testServer();
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    for (const falsch of [
      { sollMinuten: [480.5, 480, 480, 480, 480, 0, 0] },
      { lohnCent: 1250.5 },
      { lohnCent: -1 },
      { sollMinuten: [1441, 0, 0, 0, 0, 0, 0] },
      { sollMinuten: [480, 480, 480, 480, 480] },
      { gueltigAb: "2026-02-30" },
      { lohnArt: "jahr" },
    ])
      expect(
        (await mia.anfrage("/api/v1/arbeitszeit/modelle", { body: { ...VOLLZEIT, ...falsch } }))
          .status,
      ).toBe(400);
  });

  it("keeps the surcharges a model pays in basis points; none set means none paid (S-308)", async () => {
    const server = testServer();
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    const saetze = { nacht: 2500, sonntag: 5000, feiertag150: 15_000 };
    const mit = await json(
      await mia.anfrage("/api/v1/arbeitszeit/modelle", {
        body: { ...VOLLZEIT, zuschlagssaetze: saetze },
      }),
    );
    expect(mit.zuschlagssaetze).toEqual(saetze);
    const ohne = await json(await mia.anfrage("/api/v1/arbeitszeit/modelle", { body: MINIJOB }));
    expect(ohne.zuschlagssaetze).toEqual({});
    for (const falsch of [
      { nacht: 2500.5 },
      { nacht: -1 },
      { sonntag: 100_001 },
      { samstag: 2500 },
    ])
      expect(
        (
          await mia.anfrage("/api/v1/arbeitszeit/modelle", {
            body: { ...VOLLZEIT, zuschlagssaetze: falsch },
          })
        ).status,
        JSON.stringify(falsch),
      ).toBe(400);
  });

  it("defaults pausenabzug to false and keeps it when enabled on a model", async () => {
    const server = testServer();
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    const ohne = await json(await mia.anfrage("/api/v1/arbeitszeit/modelle", { body: VOLLZEIT }));
    expect(ohne.pausenabzug).toBe(false);
    const mit = await json(
      await mia.anfrage("/api/v1/arbeitszeit/modelle", {
        body: { ...VOLLZEIT, name: "Vollzeit Auto-Pause", pausenabzug: true },
      }),
    );
    expect(mit.pausenabzug).toBe(true);
  });

  it("is refused while working time is switched off", async () => {
    const server = testServer();
    const solo = await server.inhaberMitBetrieb("Solo", "solo");
    await solo.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { arbeitszeit: false } });
    const antwort = await solo.anfrage("/api/v1/arbeitszeit/modelle", { body: VOLLZEIT });
    expect(antwort.status).toBe(403);
    expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "arbeitszeit" });
  });

  it("shows wages to the owner and payroll only, and lets only the owner change them", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await weber.anfrage("/api/v1/arbeitszeit/modelle", { body: VOLLZEIT });
    const lohn = await server.eingeladen(weber, "lohnbuero", "lohnbuero");
    const anna = await server.eingeladen(weber, "planer", "anna");
    const max = await server.eingeladen(weber, "mitarbeiter", "max");
    expect((await json(await lohn.anfrage("/api/v1/arbeitszeit/modelle"))).modelle).toHaveLength(1);
    for (const p of [anna, max])
      expect((await p.anfrage("/api/v1/arbeitszeit/modelle")).status).toBe(403);
    expect((await lohn.anfrage("/api/v1/arbeitszeit/modelle", { body: VOLLZEIT })).status).toBe(
      403,
    );
  });
});

describe("no business sees another's models", () => {
  it("GET lists only one's own, DELETE does not reach another's", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    const modell = await json(
      await weber.anfrage("/api/v1/arbeitszeit/modelle", { body: VOLLZEIT }),
    );
    expect((await json(await mia.anfrage("/api/v1/arbeitszeit/modelle"))).modelle).toEqual([]);
    expect(
      (await mia.anfrage(`/api/v1/arbeitszeit/modelle/${modell.modellId}`, { method: "DELETE" }))
        .status,
    ).toBe(404);
    expect((await json(await weber.anfrage("/api/v1/arbeitszeit/modelle"))).modelle).toHaveLength(
      1,
    );
  });

  it("POST writes into one's own business only", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    await mia.anfrage("/api/v1/arbeitszeit/modelle", {
      body: { ...VOLLZEIT, betriebId: weber.betriebId },
    });
    await mia.anfrage("/api/v1/arbeitszeit/modelle", { body: MINIJOB });
    expect((await json(await weber.anfrage("/api/v1/arbeitszeit/modelle"))).modelle).toEqual([]);
  });
});
