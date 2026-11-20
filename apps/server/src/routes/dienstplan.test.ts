import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { elbblick, json, SPAET, schichtVon } from "./dienstplan-testhilfen.ts";

describe("/api/v1/dienstplan/vorlagen", () => {
  it("adds, changes, lists and removes shift templates in the audit chain", async () => {
    const { server, mia, lea } = await elbblick();
    const neu = await lea.anfrage("/api/v1/dienstplan/vorlagen", { body: SPAET });
    expect(neu.status).toBe(201);
    const vorlage = await json(neu);
    expect(vorlage).toMatchObject({ ...SPAET, standortId: null });
    const pfad = `/api/v1/dienstplan/vorlagen/${vorlage.vorlageId}`;
    const geaendert = await mia.anfrage(pfad, {
      method: "PUT",
      body: { ...SPAET, name: "Nacht", beginnMinute: 22 * 60, endeMinute: 6 * 60 },
    });
    expect(await json(geaendert)).toMatchObject({ name: "Nacht", endeMinute: 360 });
    expect((await json(await lea.anfrage("/api/v1/dienstplan/vorlagen"))).vorlagen).toHaveLength(1);
    expect((await mia.anfrage(pfad, { method: "DELETE" })).status).toBe(204);
    expect((await json(await lea.anfrage("/api/v1/dienstplan/vorlagen"))).vorlagen).toEqual([]);
    expect(kettePruefen(server.db, mia.betriebId)).toEqual([]);
  });

  it("refuses fractions, times past the day, no length and a site of nobody", async () => {
    const { lea } = await elbblick();
    for (const falsch of [
      { beginnMinute: 600.5 },
      { endeMinute: 1440 },
      { pauseMinuten: -5 },
      { endeMinute: SPAET.beginnMinute },
      { name: "" },
    ])
      expect(
        (await lea.anfrage("/api/v1/dienstplan/vorlagen", { body: { ...SPAET, ...falsch } }))
          .status,
      ).toBe(400);
    const fremd = await lea.anfrage("/api/v1/dienstplan/vorlagen", {
      body: { ...SPAET, standortId: "anderswo" },
    });
    expect(fremd.status).toBe(404);
  });

  it("is for whoever plans, not for employees", async () => {
    const { tom } = await elbblick();
    expect((await tom.anfrage("/api/v1/dienstplan/vorlagen")).status).toBe(403);
    expect((await tom.anfrage("/api/v1/dienstplan/vorlagen", { body: SPAET })).status).toBe(403);
  });
});

describe("/api/v1/dienstplan/schichten", () => {
  it("plans, moves and removes a shift as a draft with its instants and working day", async () => {
    const { server, mia, lea, tom, standortId } = await elbblick();
    const neu = await lea.anfrage("/api/v1/dienstplan/schichten", {
      body: { ...schichtVon(standortId, tom.nutzerId), beginnMinute: 22 * 60, endeMinute: 6 * 60 },
    });
    expect(neu.status).toBe(201);
    const schicht = await json(neu);
    expect(schicht).toMatchObject({
      tag: "2026-11-23",
      beginn: Date.parse("2026-11-23T21:00:00Z"),
      ende: Date.parse("2026-11-24T05:00:00Z"),
      veroeffentlichtAm: null,
      nutzerId: tom.nutzerId,
    });
    // moved by drag and drop into the night the clocks go back: 22:00 to 6:00 stays, nine hours
    const verschoben = await json(
      await lea.anfrage(`/api/v1/dienstplan/schichten/${schicht.schichtId}`, {
        method: "PATCH",
        body: { tag: "2026-10-24", nutzerId: null },
      }),
    );
    expect(verschoben).toMatchObject({ tag: "2026-10-24", nutzerId: null });
    expect((verschoben.ende as number) - (verschoben.beginn as number)).toBe(9 * 3_600_000);
    const weg = await lea.anfrage(`/api/v1/dienstplan/schichten/${schicht.schichtId}`, {
      method: "DELETE",
    });
    expect(weg.status).toBe(204);
    expect(kettePruefen(server.db, mia.betriebId)).toEqual([]);
  });

  it("refuses a time the clocks skip and a break as long as the shift", async () => {
    const { lea, standortId } = await elbblick();
    const uebersprungen = await lea.anfrage("/api/v1/dienstplan/schichten", {
      body: { ...schichtVon(standortId, null, "2026-03-29"), beginnMinute: 150 },
    });
    expect(uebersprungen.status).toBe(422);
    expect(await json(uebersprungen)).toEqual({ fehler: "zeit_gibt_es_nicht" });
    const pause = await lea.anfrage("/api/v1/dienstplan/schichten", {
      body: { ...schichtVon(standortId, null), pauseMinuten: 480 },
    });
    expect(pause.status).toBe(400);
  });

  it("refuses a person who is no member, a device and an unknown shift", async () => {
    const { server, mia, lea, standortId } = await elbblick();
    const geraet = await server.eingeladen(mia, "geraet", "terminal");
    for (const nutzerId of ["niemand", geraet.nutzerId]) {
      const antwort = await lea.anfrage("/api/v1/dienstplan/schichten", {
        body: schichtVon(standortId, nutzerId),
      });
      expect(antwort.status).toBe(404);
      expect(await json(antwort)).toEqual({ fehler: "person_unbekannt" });
    }
    const unbekannt = await lea.anfrage("/api/v1/dienstplan/schichten/gibt-es-nicht", {
      method: "PATCH",
      body: { tag: "2026-11-24" },
    });
    expect(unbekannt.status).toBe(404);
  });

  it("lets no employee plan", async () => {
    const { tom, standortId } = await elbblick();
    const antwort = await tom.anfrage("/api/v1/dienstplan/schichten", {
      body: schichtVon(standortId, tom.nutzerId),
    });
    expect(antwort.status).toBe(403);
  });
});

describe("/api/v1/dienstplan/woche", () => {
  it("shows the planner the draft, the people and the need per role", async () => {
    const { lea, tom, standortId } = await elbblick();
    await lea.anfrage("/api/v1/dienstplan/bedarf", {
      body: {
        standortId,
        rolle: "Service",
        wochentag: 1,
        beginnMinute: 840,
        endeMinute: 1320,
        anzahl: 2,
      },
    });
    await lea.anfrage("/api/v1/dienstplan/schichten", {
      body: schichtVon(standortId, tom.nutzerId),
    });
    await lea.anfrage("/api/v1/dienstplan/schichten", { body: schichtVon(standortId, null) });
    const woche = await json(
      await lea.anfrage(`/api/v1/dienstplan/woche?standortId=${standortId}&tag=2026-11-26`),
    );
    expect(woche.tage).toHaveLength(7);
    expect(woche.kw).toEqual({ jahr: 2026, nummer: 48 });
    expect(woche.schichten).toHaveLength(2);
    expect((woche.personen as { name: string }[]).map((p) => p.name)).toEqual(
      expect.arrayContaining(["tom", "lea"]),
    );
    expect(woche.deckung).toEqual([
      expect.objectContaining({ tag: "2026-11-23", anzahl: 2, geplant: 1, offen: 1, fehlt: 1 }),
    ]);
  });

  it("shows employees nothing unpublished, no member list and no need", async () => {
    const { lea, tom, standortId } = await elbblick();
    await lea.anfrage("/api/v1/dienstplan/schichten", {
      body: schichtVon(standortId, tom.nutzerId),
    });
    const antwort = await tom.anfrage(
      `/api/v1/dienstplan/woche?standortId=${standortId}&tag=2026-11-23`,
    );
    expect(antwort.status).toBe(200);
    expect(await json(antwort)).toMatchObject({ schichten: [], personen: [], deckung: null });
  });

  it("is refused while the module Dienstplan is off, the data stays", async () => {
    const { mia, lea, tom, standortId } = await elbblick();
    await lea.anfrage("/api/v1/dienstplan/schichten", {
      body: schichtVon(standortId, tom.nutzerId),
    });
    await mia.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: false } });
    for (const [pfad, init] of [
      [`/api/v1/dienstplan/woche?standortId=${standortId}`, {}],
      ["/api/v1/dienstplan/vorlagen", { body: SPAET }],
      ["/api/v1/dienstplan/schichten", { body: schichtVon(standortId, null) }],
      [`/api/v1/dienstplan/bedarf?standortId=${standortId}`, {}],
    ] as const) {
      const antwort = await lea.anfrage(pfad, init);
      expect(antwort.status, pfad).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "dienstplan" });
    }
    await mia.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
    const woche = await json(
      await lea.anfrage(`/api/v1/dienstplan/woche?standortId=${standortId}&tag=2026-11-23`),
    );
    expect(woche.schichten).toHaveLength(1);
  });
});

describe("/api/v1/dienstplan/bedarf", () => {
  it("adds, lists and removes the need of a site; a site with a plan is not removed", async () => {
    const { mia, lea, standortId } = await elbblick();
    const bedarf = {
      standortId,
      rolle: "Küche",
      wochentag: 6,
      beginnMinute: 600,
      endeMinute: 900,
      anzahl: 1,
    };
    const neu = await json(await lea.anfrage("/api/v1/dienstplan/bedarf", { body: bedarf }));
    expect(neu).toMatchObject(bedarf);
    expect(
      (await mia.anfrage(`/api/v1/standorte/${standortId}`, { method: "DELETE" })).status,
    ).toBe(409);
    const liste = await json(
      await lea.anfrage(`/api/v1/dienstplan/bedarf?standortId=${standortId}`),
    );
    expect(liste.bedarfe).toHaveLength(1);
    expect(
      (await lea.anfrage(`/api/v1/dienstplan/bedarf/${neu.bedarfId}`, { method: "DELETE" })).status,
    ).toBe(204);
    expect(
      (await mia.anfrage(`/api/v1/standorte/${standortId}`, { method: "DELETE" })).status,
    ).toBe(204);
  });

  it("refuses a need without a role, with nobody or on an eighth weekday", async () => {
    const { lea, standortId } = await elbblick();
    const gut = {
      standortId,
      rolle: "Küche",
      wochentag: 6,
      beginnMinute: 600,
      endeMinute: 900,
      anzahl: 1,
    };
    for (const falsch of [{ rolle: " " }, { anzahl: 0 }, { wochentag: 8 }, { anzahl: 1.5 }])
      expect(
        (await lea.anfrage("/api/v1/dienstplan/bedarf", { body: { ...gut, ...falsch } })).status,
      ).toBe(400);
  });
});
