import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { testServer } from "../test-server.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;
// 20.11.2026, a Friday in winter time (+01:00)
const um = (zeit: string) => Date.parse(`2026-11-20T${zeit}+01:00`);

const VOLLZEIT = {
  name: "Vollzeit",
  sollMinuten: [480, 480, 480, 480, 420, 0, 0],
  lohnArt: "monat",
  lohnCent: 320_000,
  minijob: false,
  gueltigAb: "2026-11-01",
};

/** Café Elbblick with Tom, who works in shifts, at 7:58 on 20.11.2026 */
const cafe = async () => {
  const server = testServer();
  server.stelleUhr(um("07:58"));
  const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  const tom = await server.eingeladen(mia, "mitarbeiter", "tom");
  return { server, mia, tom };
};

describe("stamping on Heute (S-304)", () => {
  it("takes the server's clock for a live stamp and keeps the device's beside it", async () => {
    const { server, tom } = await cafe();
    const antwort = await tom.anfrage("/api/v1/arbeitszeit/stempelungen", {
      body: { art: "kommen", geraetZeitpunkt: um("07:50") },
    });
    expect(antwort.status).toBe(201);
    expect(await json(antwort)).toMatchObject({
      art: "kommen",
      zeitpunkt: um("07:58"),
      geraetZeitpunkt: um("07:50"),
      nutzerId: tom.nutzerId,
      quelle: "app",
      korrigiert: false,
    });
    expect(server.sqlite.query("SELECT zeitpunkt FROM stempelungen").all()).toEqual([
      { zeitpunkt: um("07:58") },
    ]);
  });

  it("refuses an instant or another person in a live stamp: the server counts, for oneself", async () => {
    const { mia, tom } = await cafe();
    for (const falsch of [
      { art: "kommen", zeitpunkt: um("07:00") },
      { art: "kommen", nutzerId: mia.nutzerId },
      { art: "anfang" },
      { art: "kommen", geraetZeitpunkt: 1.5 },
    ]) {
      const antwort = await tom.anfrage("/api/v1/arbeitszeit/stempelungen", { body: falsch });
      expect(antwort.status, JSON.stringify(falsch)).toBe(400);
    }
  });

  it("shows the running day: state, target from the model, minutes so far and the next finding", async () => {
    const { server, mia, tom } = await cafe();
    const modell = await json(await mia.anfrage("/api/v1/arbeitszeit/modelle", { body: VOLLZEIT }));
    const zugeordnet = await mia.anfrage(`/api/v1/arbeitszeit/personen/${tom.nutzerId}/modell`, {
      method: "PUT",
      body: { modellId: modell.modellId },
    });
    expect(zugeordnet.status).toBe(200);
    await tom.anfrage("/api/v1/arbeitszeit/stempelungen", { body: { art: "kommen" } });
    server.stelleUhr(um("12:10"));
    const tag = await json(await tom.anfrage("/api/v1/arbeitszeit/tag"));
    expect(tag).toMatchObject({
      tag: "2026-11-20",
      jetzt: um("12:10"),
      nutzerId: tom.nutzerId,
      name: "tom",
      // Friday in the model: 7:00
      sollMinuten: 420,
      stand: {
        zustand: "arbeit",
        seit: um("07:58"),
        istMinuten: 252,
        ausblick: { art: "pause", norm: "§ 4 ArbZG", inMinuten: 108, minuten: 30 },
      },
      stempelungen: [expect.objectContaining({ art: "kommen", zeitpunkt: um("07:58") })],
      aenderungen: [],
    });
  });

  it("says nicht hinterlegt for the target of a person without a model", async () => {
    const { tom } = await cafe();
    expect((await json(await tom.anfrage("/api/v1/arbeitszeit/tag"))).sollMinuten).toBeNull();
  });

  it("goes through Pause and Gehen, counts the day and never stamps out by itself", async () => {
    const { server, tom } = await cafe();
    const stempel = async (art: string, zeit: string) => {
      server.stelleUhr(um(zeit));
      await tom.anfrage("/api/v1/arbeitszeit/stempelungen", { body: { art } });
    };
    await stempel("kommen", "08:00");
    await stempel("pause_beginn", "12:00");
    server.stelleUhr(um("12:10"));
    expect((await json(await tom.anfrage("/api/v1/arbeitszeit/tag"))).stand).toMatchObject({
      zustand: "pause",
      seit: um("12:00"),
      pausenMinuten: 10,
    });
    await stempel("pause_ende", "12:30");
    await stempel("gehen", "16:30");
    server.stelleUhr(um("23:00"));
    const tag = await json(await tom.anfrage("/api/v1/arbeitszeit/tag"));
    expect(tag.stand).toMatchObject({ zustand: "aus", istMinuten: 480, pausenMinuten: 30 });
    expect(tag.stempelungen).toHaveLength(4);
    expect(
      kettePruefen(
        server.db,
        (await json(await tom.anfrage("/api/v1/betrieb"))).betriebId as string,
      ),
    ).toEqual([]);
  });

  it("keeps a forgotten Gehen open the next morning and reports it (R-01)", async () => {
    const { server, tom } = await cafe();
    await tom.anfrage("/api/v1/arbeitszeit/stempelungen", { body: { art: "kommen" } });
    server.stelleUhr(Date.parse("2026-11-21T07:00:00+01:00"));
    const tag = await json(await tom.anfrage("/api/v1/arbeitszeit/tag"));
    expect(tag.tag).toBe("2026-11-20");
    expect(tag.stand).toMatchObject({
      zustand: "arbeit",
      befunde: [expect.objectContaining({ art: "gehen_fehlt", norm: "§ 3 Abs. 2 Nr. 1 ArbSchG" })],
    });
    expect(server.sqlite.query("SELECT art FROM stempelungen").all()).toEqual([{ art: "kommen" }]);
  });

  it("lets everyone who works for the business stamp, but no external staff", async () => {
    const { server, mia } = await cafe();
    const extern = await server.eingeladen(mia, "extern", "freelancer");
    const antwort = await extern.anfrage("/api/v1/arbeitszeit/stempelungen", {
      body: { art: "kommen" },
    });
    expect(antwort.status).toBe(403);
    expect(
      (await mia.anfrage("/api/v1/arbeitszeit/stempelungen", { body: { art: "kommen" } })).status,
    ).toBe(201);
  });

  it("refuses every route of stamping while working time is off", async () => {
    const server = testServer();
    server.stelleUhr(um("08:00"));
    const solo = await server.inhaberMitBetrieb("Lotsenbüro", "lotse");
    await solo.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { arbeitszeit: false } });
    const routen: [string, string, unknown?][] = [
      ["GET", "/api/v1/arbeitszeit/tag"],
      ["POST", "/api/v1/arbeitszeit/stempelungen", { art: "kommen" }],
      [
        "POST",
        "/api/v1/arbeitszeit/stempelungen/nachtrag",
        { art: "kommen", zeitpunkt: um("07:00"), grund: "vergessen" },
      ],
      [
        "PATCH",
        "/api/v1/arbeitszeit/stempelungen/x",
        { art: "kommen", zeitpunkt: um("07:00"), grund: "falsch" },
      ],
      ["POST", "/api/v1/arbeitszeit/stempelungen/x/entfernen", { grund: "doppelt" }],
      ["GET", "/api/v1/arbeitszeit/personen"],
      ["PUT", `/api/v1/arbeitszeit/personen/${solo.nutzerId}/modell`, { modellId: "x" }],
    ];
    for (const [method, pfad, body] of routen) {
      const antwort = await solo.anfrage(pfad, { method, body });
      expect(antwort.status, `${method} ${pfad}`).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "arbeitszeit" });
    }
  });
});
