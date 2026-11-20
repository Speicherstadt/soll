import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";
import { elbblick, json, SPAET, schichtVon } from "./dienstplan-testhilfen.ts";

/** Two businesses on one server: Café Elbblick with a plan, Weber Haustechnik with the module on */
const zweiBetriebe = async () => {
  const server = testServer();
  const elbe = await elbblick(server);
  const jonas = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  await jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
  const werkstatt = await json(
    await jonas.anfrage("/api/v1/standorte", { body: { name: "Werkstatt", land: "HH" } }),
  );
  const vorlage = await json(
    await elbe.lea.anfrage("/api/v1/dienstplan/vorlagen", { body: SPAET }),
  );
  const schicht = await json(
    await elbe.lea.anfrage("/api/v1/dienstplan/schichten", {
      body: schichtVon(elbe.standortId, elbe.tom.nutzerId),
    }),
  );
  const bedarf = await json(
    await elbe.lea.anfrage("/api/v1/dienstplan/bedarf", {
      body: {
        standortId: elbe.standortId,
        rolle: "Service",
        wochentag: 1,
        beginnMinute: 840,
        endeMinute: 1320,
        anzahl: 1,
      },
    }),
  );
  return { ...elbe, jonas, werkstattId: werkstatt.standortId as string, vorlage, schicht, bedarf };
};

describe("no business sees or changes another's plan", () => {
  it("GET woche and GET bedarf do not open another's site", async () => {
    const { jonas, standortId } = await zweiBetriebe();
    for (const pfad of [
      `/api/v1/dienstplan/woche?standortId=${standortId}&tag=2026-11-23`,
      `/api/v1/dienstplan/bedarf?standortId=${standortId}`,
    ])
      expect((await jonas.anfrage(pfad)).status, pfad).toBe(404);
  });

  it("GET vorlagen and the week of one's own site list nothing of the other business", async () => {
    const { jonas, werkstattId } = await zweiBetriebe();
    expect((await json(await jonas.anfrage("/api/v1/dienstplan/vorlagen"))).vorlagen).toEqual([]);
    const woche = await json(
      await jonas.anfrage(`/api/v1/dienstplan/woche?standortId=${werkstattId}&tag=2026-11-23`),
    );
    expect(woche).toMatchObject({ schichten: [], deckung: [] });
    expect((woche.personen as { name: string }[]).map((p) => p.name)).not.toContain("tom");
  });

  it("PUT and DELETE do not reach another's template, need or shift", async () => {
    const { jonas, lea, standortId, vorlage, schicht, bedarf } = await zweiBetriebe();
    const versuche = [
      [`/api/v1/dienstplan/vorlagen/${vorlage.vorlageId}`, { method: "PUT", body: SPAET }],
      [`/api/v1/dienstplan/vorlagen/${vorlage.vorlageId}`, { method: "DELETE" }],
      [`/api/v1/dienstplan/bedarf/${bedarf.bedarfId}`, { method: "DELETE" }],
      [
        `/api/v1/dienstplan/schichten/${schicht.schichtId}`,
        { method: "PATCH", body: { tag: "2026-11-24" } },
      ],
      [`/api/v1/dienstplan/schichten/${schicht.schichtId}`, { method: "DELETE" }],
    ] as const;
    for (const [pfad, init] of versuche)
      expect((await jonas.anfrage(pfad, init)).status, `${init.method} ${pfad}`).toBe(404);
    const woche = await json(
      await lea.anfrage(`/api/v1/dienstplan/woche?standortId=${standortId}&tag=2026-11-23`),
    );
    expect(woche.schichten).toEqual([expect.objectContaining({ tag: "2026-11-23" })]);
    expect((await json(await lea.anfrage("/api/v1/dienstplan/vorlagen"))).vorlagen).toEqual([
      expect.objectContaining({ name: "Spät" }),
    ]);
    expect(woche.deckung).toHaveLength(1);
  });

  it("POST refuses another's site, person and template and never names a business", async () => {
    const { jonas, mia, tom, werkstattId, standortId, vorlage } = await zweiBetriebe();
    const versuche = [
      ["/api/v1/dienstplan/schichten", schichtVon(standortId, null), "standort_unbekannt"],
      ["/api/v1/dienstplan/schichten", schichtVon(werkstattId, tom.nutzerId), "person_unbekannt"],
      [
        "/api/v1/dienstplan/schichten",
        { ...schichtVon(werkstattId, null), vorlageId: vorlage.vorlageId },
        "vorlage_unbekannt",
      ],
      ["/api/v1/dienstplan/vorlagen", { ...SPAET, standortId }, "standort_unbekannt"],
      [
        "/api/v1/dienstplan/bedarf",
        {
          standortId,
          rolle: "Service",
          wochentag: 1,
          beginnMinute: 600,
          endeMinute: 700,
          anzahl: 1,
        },
        "standort_unbekannt",
      ],
    ] as const;
    for (const [pfad, body, fehler] of versuche) {
      const antwort = await jonas.anfrage(pfad, { body });
      expect(antwort.status, pfad).toBe(404);
      expect(await json(antwort)).toEqual({ fehler });
    }
    const mitBetrieb = await jonas.anfrage("/api/v1/dienstplan/vorlagen", {
      body: { ...SPAET, betriebId: mia.betriebId },
    });
    expect(mitBetrieb.status).toBe(400);
  });

  it("PATCH does not move one's own shift to another's site or person", async () => {
    const { lea, tom, jonas, werkstattId, schicht } = await zweiBetriebe();
    const fremd = await json(
      await jonas.anfrage("/api/v1/dienstplan/schichten", { body: schichtVon(werkstattId, null) }),
    );
    for (const body of [{ standortId: werkstattId }, { nutzerId: "niemand" }])
      expect(
        (
          await lea.anfrage(`/api/v1/dienstplan/schichten/${schicht.schichtId}`, {
            method: "PATCH",
            body,
          })
        ).status,
      ).toBe(404);
    expect(
      (
        await jonas.anfrage(`/api/v1/dienstplan/schichten/${fremd.schichtId}`, {
          method: "PATCH",
          body: { nutzerId: tom.nutzerId },
        })
      ).status,
    ).toBe(404);
  });
});
