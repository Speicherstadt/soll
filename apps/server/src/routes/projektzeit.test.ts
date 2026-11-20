import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { testServer } from "../test-server.ts";
import { anlegen, json, mitProjektzeit, PZ, weberMitAuftrag } from "./projektzeit-testhilfen.ts";

describe("/api/v1/projektzeit/kunden", () => {
  it("adds, renames, archives and restores customers through the audit chain", async () => {
    const { server, weber, kunde } = await weberMitAuftrag();
    expect(kunde).toMatchObject({ name: "Elbhof", nummer: "K-1001", archiviertAm: null });
    const geaendert = await weber.anfrage(`${PZ}/kunden/${kunde.kundeId}`, {
      method: "PATCH",
      body: { name: "Elbhof GmbH", archiviert: true },
    });
    expect(geaendert.status).toBe(200);
    expect(await json(geaendert)).toMatchObject({
      name: "Elbhof GmbH",
      archiviertAm: 1_790_000_000_000,
    });
    const zurueck = await weber.anfrage(`${PZ}/kunden/${kunde.kundeId}`, {
      method: "PATCH",
      body: { archiviert: false },
    });
    expect(await json(zurueck)).toMatchObject({ name: "Elbhof GmbH", archiviertAm: null });
    expect((await json(await weber.anfrage(`${PZ}/kunden`))).kunden).toHaveLength(1);
    expect(kettePruefen(server.db, weber.betriebId)).toEqual([]);
  });

  it("removes a customer nothing names, and archives instead of removing one an order names", async () => {
    const { weber, kunde } = await weberMitAuftrag();
    const verwendet = await weber.anfrage(`${PZ}/kunden/${kunde.kundeId}`, { method: "DELETE" });
    expect(verwendet.status).toBe(409);
    expect(await json(verwendet)).toEqual({ fehler: "verwendet" });
    const frei = await anlegen(weber, "/kunden", { name: "Hafenbar" });
    expect((await weber.anfrage(`${PZ}/kunden/${frei.kundeId}`, { method: "DELETE" })).status).toBe(
      204,
    );
    expect((await weber.anfrage(`${PZ}/kunden/${frei.kundeId}`, { method: "DELETE" })).status).toBe(
      404,
    );
  });

  it("keeps a reference to another source once per business (Haben, an import)", async () => {
    const { weber } = await weberMitAuftrag();
    const extern = { externQuelle: "haben", externId: "8b0c-1" };
    expect(await anlegen(weber, "/kunden", { name: "Elbhof", ...extern })).toMatchObject(extern);
    const doppelt = await weber.anfrage(`${PZ}/kunden`, { body: { name: "Elbhof 2", ...extern } });
    expect(doppelt.status).toBe(409);
    expect(await json(doppelt)).toEqual({ fehler: "doppelt" });
    // another business may hold the same reference
    const server = testServer();
    const mia = await mitProjektzeit(server, "Café Elbblick", "elbblick");
    expect(
      (await mia.anfrage(`${PZ}/kunden`, { body: { name: "Elbhof", ...extern } })).status,
    ).toBe(201);
  });

  it("refuses an empty name, half a reference and an unknown field", async () => {
    const { weber } = await weberMitAuftrag();
    for (const falsch of [
      { name: " " },
      { name: "Elbhof", externQuelle: "haben" },
      { name: "Elbhof", externId: "1" },
      { name: "Elbhof", externQuelle: "Haben!", externId: "1" },
      { name: "Elbhof", archiviertAm: 1 },
    ])
      expect(
        (await weber.anfrage(`${PZ}/kunden`, { body: falsch })).status,
        JSON.stringify(falsch),
      ).toBe(400);
  });
});

describe("/api/v1/projektzeit/projekte", () => {
  it("adds an order of a customer with a budget in whole minutes and cents and a threshold", async () => {
    const { weber, kunde, projekt } = await weberMitAuftrag();
    expect(projekt).toMatchObject({
      kundeId: kunde.kundeId,
      name: "Bad Elbhof",
      nummer: "",
      budgetMinuten: 2_400,
      budgetCent: 400_000,
      warnungProzent: 80,
      archiviertAm: null,
    });
    const geaendert = await weber.anfrage(`${PZ}/projekte/${projekt.projektId}`, {
      method: "PATCH",
      body: { budgetCent: null, warnungProzent: 90, nummer: "A-17" },
    });
    expect(await json(geaendert)).toMatchObject({
      budgetMinuten: 2_400,
      budgetCent: null,
      warnungProzent: 90,
      nummer: "A-17",
    });
  });

  it("refuses fractions, budgets of zero or below, a threshold outside 1 to 100 and a change of customer", async () => {
    const { weber, kunde, projekt } = await weberMitAuftrag();
    const basis = { kundeId: kunde.kundeId, name: "Küche" };
    for (const falsch of [
      { budgetMinuten: 90.5 },
      { budgetCent: 100.5 },
      { budgetMinuten: 0 },
      { budgetCent: -1 },
      { warnungProzent: 0 },
      { warnungProzent: 101 },
      { warnungProzent: 79.5 },
    ])
      expect(
        (await weber.anfrage(`${PZ}/projekte`, { body: { ...basis, ...falsch } })).status,
      ).toBe(400);
    const wechsel = await weber.anfrage(`${PZ}/projekte/${projekt.projektId}`, {
      method: "PATCH",
      body: { kundeId: kunde.kundeId },
    });
    expect(wechsel.status).toBe(400);
  });

  it("needs a known customer that is not archived", async () => {
    const { weber, kunde } = await weberMitAuftrag();
    const unbekannt = await weber.anfrage(`${PZ}/projekte`, {
      body: { kundeId: "nix", name: "Küche" },
    });
    expect(unbekannt.status).toBe(422);
    expect(await json(unbekannt)).toEqual({ fehler: "kunde_unbekannt" });
    await weber.anfrage(`${PZ}/kunden/${kunde.kundeId}`, {
      method: "PATCH",
      body: { archiviert: true },
    });
    const archiviert = await weber.anfrage(`${PZ}/projekte`, {
      body: { kundeId: kunde.kundeId, name: "Küche" },
    });
    expect(archiviert.status).toBe(409);
    expect(await json(archiviert)).toEqual({ fehler: "archiviert" });
  });

  it("removes an order no rate names, and archives one a rate names", async () => {
    const { weber, projekt } = await weberMitAuftrag();
    await anlegen(weber, "/saetze", { projektId: projekt.projektId, centProStunde: 7_500 });
    expect(
      (await weber.anfrage(`${PZ}/projekte/${projekt.projektId}`, { method: "DELETE" })).status,
    ).toBe(409);
    const archiviert = await weber.anfrage(`${PZ}/projekte/${projekt.projektId}`, {
      method: "PATCH",
      body: { archiviert: true },
    });
    expect((await json(archiviert)).archiviertAm).toBe(1_790_000_000_000);
  });

  it("shows employees the orders without money", async () => {
    const { server, weber } = await weberMitAuftrag();
    const max = await server.eingeladen(weber, "mitarbeiter", "max");
    const [auftrag] = (await json(await max.anfrage(`${PZ}/projekte`))).projekte as Record<
      string,
      unknown
    >[];
    expect(auftrag).toMatchObject({ name: "Bad Elbhof", budgetMinuten: 2_400 });
    expect(auftrag).not.toHaveProperty("budgetCent");
    const anna = await server.eingeladen(weber, "planer", "anna");
    const [vollstaendig] = (await json(await anna.anfrage(`${PZ}/projekte`))).projekte as Record<
      string,
      unknown
    >[];
    expect(vollstaendig?.budgetCent).toBe(400_000);
  });
});

describe("/api/v1/projektzeit/taetigkeiten", () => {
  it("always lists the four fixed internal activities first, not billed by default", async () => {
    const { weber } = await weberMitAuftrag();
    const liste = (await json(await weber.anfrage(`${PZ}/taetigkeiten`))).taetigkeiten;
    expect(liste).toEqual(
      ["fahrt", "werkstatt", "lager", "schulung"].map((taetigkeitId) =>
        expect.objectContaining({
          taetigkeitId,
          fest: true,
          name: "",
          abrechenbar: false,
          archiviertAm: null,
        }),
      ),
    );
  });

  it("adds own activities, billed by default, and lists them after the fixed ones", async () => {
    const { weber } = await weberMitAuftrag();
    const montage = await anlegen(weber, "/taetigkeiten", { name: "Montage" });
    expect(montage).toMatchObject({ name: "Montage", fest: false, abrechenbar: true });
    const liste = (await json(await weber.anfrage(`${PZ}/taetigkeiten`))).taetigkeiten as unknown[];
    expect(liste).toHaveLength(5);
    expect(liste[4]).toMatchObject({ taetigkeitId: montage.taetigkeitId });
  });

  it("lets the business bill a fixed one, but never rename, archive or remove it", async () => {
    const { server, weber } = await weberMitAuftrag();
    const fahrt = await weber.anfrage(`${PZ}/taetigkeiten/fahrt`, {
      method: "PATCH",
      body: { abrechenbar: true },
    });
    expect(fahrt.status).toBe(200);
    expect(await json(fahrt)).toMatchObject({
      taetigkeitId: "fahrt",
      fest: true,
      abrechenbar: true,
    });
    const wieder = await weber.anfrage(`${PZ}/taetigkeiten/fahrt`, {
      method: "PATCH",
      body: { abrechenbar: false },
    });
    expect((await json(wieder)).abrechenbar).toBe(false);
    for (const body of [{ name: "Anfahrt" }, { archiviert: true }]) {
      const antwort = await weber.anfrage(`${PZ}/taetigkeiten/fahrt`, { method: "PATCH", body });
      expect(antwort.status).toBe(409);
      expect(await json(antwort)).toEqual({ fehler: "fest" });
    }
    const weg = await weber.anfrage(`${PZ}/taetigkeiten/lager`, { method: "DELETE" });
    expect(weg.status).toBe(409);
    expect(await json(weg)).toEqual({ fehler: "fest" });
    expect((await json(await weber.anfrage(`${PZ}/taetigkeiten`))).taetigkeiten).toHaveLength(4);
    expect(kettePruefen(server.db, weber.betriebId)).toEqual([]);
  });

  it("removes an own activity no rate names, archives one a rate names", async () => {
    const { weber } = await weberMitAuftrag();
    const montage = await anlegen(weber, "/taetigkeiten", { name: "Montage", abrechenbar: true });
    const wartung = await anlegen(weber, "/taetigkeiten", { name: "Wartung" });
    await anlegen(weber, "/saetze", { taetigkeitId: montage.taetigkeitId, centProStunde: 8_500 });
    expect(
      (await weber.anfrage(`${PZ}/taetigkeiten/${montage.taetigkeitId}`, { method: "DELETE" }))
        .status,
    ).toBe(409);
    expect(
      (await weber.anfrage(`${PZ}/taetigkeiten/${wartung.taetigkeitId}`, { method: "DELETE" }))
        .status,
    ).toBe(204);
    const archiviert = await weber.anfrage(`${PZ}/taetigkeiten/${montage.taetigkeitId}`, {
      method: "PATCH",
      body: { archiviert: true, name: "Montage alt" },
    });
    expect(await json(archiviert)).toMatchObject({
      name: "Montage alt",
      archiviertAm: 1_790_000_000_000,
    });
    expect(
      (
        await weber.anfrage(`${PZ}/taetigkeiten/unbekannt`, {
          method: "PATCH",
          body: { abrechenbar: true },
        })
      ).status,
    ).toBe(404);
  });
});

describe("the module Projektzeit", () => {
  it("refuses every route while it is switched off", async () => {
    const { weber, kunde, projekt } = await weberMitAuftrag();
    await weber.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { projektzeit: false },
    });
    const aufrufe: [string, string, unknown?][] = [
      ["GET", "/kunden"],
      ["POST", "/kunden", { name: "Hafenbar" }],
      ["PATCH", `/kunden/${kunde.kundeId}`, { name: "X" }],
      ["DELETE", `/kunden/${kunde.kundeId}`],
      ["GET", "/projekte"],
      ["POST", "/projekte", { kundeId: kunde.kundeId, name: "Küche" }],
      ["PATCH", `/projekte/${projekt.projektId}`, { name: "X" }],
      ["DELETE", `/projekte/${projekt.projektId}`],
      ["GET", "/taetigkeiten"],
      ["POST", "/taetigkeiten", { name: "Montage" }],
      ["PATCH", "/taetigkeiten/fahrt", { abrechenbar: true }],
      ["DELETE", "/taetigkeiten/fahrt"],
      ["GET", "/saetze"],
      ["POST", "/saetze", { centProStunde: 5_500 }],
      ["DELETE", "/saetze/x"],
      ["GET", "/saetze/gilt?taetigkeitId=fahrt&nutzerId=x&tag=2026-11-20"],
    ];
    for (const [method, pfad, body] of aufrufe) {
      const antwort = await weber.anfrage(`${PZ}${pfad}`, { method, body });
      expect(antwort.status, `${method} ${pfad}`).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "projektzeit" });
    }
    // the data stays (docs/plan.md, "Module")
    await weber.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { projektzeit: true } });
    expect((await json(await weber.anfrage(`${PZ}/kunden`))).kunden).toHaveLength(1);
  });

  it("lets only owner and planner change customers, orders and activities", async () => {
    const { server, weber, kunde, projekt } = await weberMitAuftrag();
    const anna = await server.eingeladen(weber, "planer", "anna");
    expect((await anna.anfrage(`${PZ}/kunden`, { body: { name: "Hafenbar" } })).status).toBe(201);
    for (const rolle of ["mitarbeiter", "lohnbuero", "betriebsrat", "extern"]) {
      const p = await server.eingeladen(weber, rolle, `p${rolle}`);
      expect((await p.anfrage(`${PZ}/kunden`)).status, rolle).toBe(200);
      for (const [method, pfad, body] of [
        ["POST", "/kunden", { name: "X" }],
        ["PATCH", `/kunden/${kunde.kundeId}`, { name: "X" }],
        ["DELETE", `/kunden/${kunde.kundeId}`],
        ["POST", "/projekte", { kundeId: kunde.kundeId, name: "X" }],
        ["PATCH", `/projekte/${projekt.projektId}`, { name: "X" }],
        ["DELETE", `/projekte/${projekt.projektId}`],
        ["POST", "/taetigkeiten", { name: "X" }],
        ["PATCH", "/taetigkeiten/fahrt", { abrechenbar: true }],
        ["DELETE", "/taetigkeiten/fahrt"],
      ] as const)
        expect(
          (await p.anfrage(`${PZ}${pfad}`, { method, body })).status,
          `${rolle} ${method} ${pfad}`,
        ).toBe(403);
    }
  });
});
