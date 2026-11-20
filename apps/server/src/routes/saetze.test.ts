import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { anlegen, json, PZ, weberMitAuftrag } from "./projektzeit-testhilfen.ts";

describe("/api/v1/projektzeit/saetze", () => {
  it("adds and lists rates in whole cents from a day, today in Europe/Berlin by default", async () => {
    const { server, weber, kunde } = await weberMitAuftrag();
    const satz = await anlegen(weber, "/saetze", { kundeId: kunde.kundeId, centProStunde: 6_500 });
    expect(satz).toMatchObject({
      kundeId: kunde.kundeId,
      projektId: null,
      taetigkeitId: null,
      nutzerId: null,
      centProStunde: 6_500,
      gueltigAb: "2026-09-21",
    });
    expect(satz).not.toHaveProperty("schluessel");
    const liste = (await json(await weber.anfrage(`${PZ}/saetze`))).saetze;
    expect(liste).toEqual([expect.objectContaining({ satzId: satz.satzId })]);
    expect((await weber.anfrage(`${PZ}/saetze/${satz.satzId}`, { method: "DELETE" })).status).toBe(
      204,
    );
    expect((await weber.anfrage(`${PZ}/saetze/${satz.satzId}`, { method: "DELETE" })).status).toBe(
      404,
    );
    expect(kettePruefen(server.db, weber.betriebId)).toEqual([]);
  });

  it("answers which rate is in force for a booking, in the order of the precedence", async () => {
    const { weber, kunde, projekt } = await weberMitAuftrag();
    const montage = await anlegen(weber, "/taetigkeiten", { name: "Montage" });
    const gilt = async () =>
      json(
        await weber.anfrage(
          `${PZ}/saetze/gilt?projektId=${projekt.projektId}&taetigkeitId=${montage.taetigkeitId}&nutzerId=${weber.nutzerId}&tag=2026-11-20`,
        ),
      );
    expect(await gilt()).toEqual({ art: "nicht_hinterlegt" });
    const fuer = { gueltigAb: "2026-01-01" };
    await anlegen(weber, "/saetze", { ...fuer, centProStunde: 5_500 });
    expect(await gilt()).toMatchObject({ art: "satz", centProStunde: 5_500 });
    await anlegen(weber, "/saetze", { ...fuer, kundeId: kunde.kundeId, centProStunde: 6_500 });
    expect(await gilt()).toMatchObject({ centProStunde: 6_500 });
    await anlegen(weber, "/saetze", {
      ...fuer,
      projektId: projekt.projektId,
      nutzerId: weber.nutzerId,
      centProStunde: 8_000,
    });
    expect(await gilt()).toMatchObject({ centProStunde: 8_000 });
    await anlegen(weber, "/saetze", {
      ...fuer,
      taetigkeitId: montage.taetigkeitId,
      centProStunde: 8_500,
    });
    expect(await gilt()).toMatchObject({ centProStunde: 8_500 });
  });

  it("refuses a rate that names an order and a customer, fractions, a negative rate and a bad day", async () => {
    const { weber, kunde, projekt } = await weberMitAuftrag();
    for (const falsch of [
      { kundeId: kunde.kundeId, projektId: projekt.projektId, centProStunde: 1 },
      { centProStunde: 65.5 },
      { centProStunde: -1 },
      { centProStunde: 100, gueltigAb: "2026-02-30" },
      { centProStunde: 100, satzId: "eigen" },
    ])
      expect(
        (await weber.anfrage(`${PZ}/saetze`, { body: falsch })).status,
        JSON.stringify(falsch),
      ).toBe(400);
  });

  it("refuses the same rate from the same day twice, and what the business does not know", async () => {
    const { server, weber, projekt } = await weberMitAuftrag();
    await anlegen(weber, "/saetze", {
      projektId: projekt.projektId,
      centProStunde: 7_500,
      gueltigAb: "2026-01-01",
    });
    const doppelt = await weber.anfrage(`${PZ}/saetze`, {
      body: { projektId: projekt.projektId, centProStunde: 7_900, gueltigAb: "2026-01-01" },
    });
    expect(doppelt.status).toBe(409);
    expect(await json(doppelt)).toEqual({ fehler: "doppelt" });
    for (const [feld, fehler] of [
      ["kundeId", "kunde_unbekannt"],
      ["projektId", "projekt_unbekannt"],
      ["taetigkeitId", "taetigkeit_unbekannt"],
      ["nutzerId", "person_unbekannt"],
    ]) {
      const antwort = await weber.anfrage(`${PZ}/saetze`, {
        body: { [feld as string]: "nix", centProStunde: 1 },
      });
      expect(antwort.status, feld).toBe(422);
      expect(await json(antwort)).toEqual({ fehler });
    }
    // a fixed activity and a member are known; an archived order takes no new rate
    const max = await server.eingeladen(weber, "mitarbeiter", "max");
    expect(
      (
        await weber.anfrage(`${PZ}/saetze`, {
          body: { taetigkeitId: "fahrt", nutzerId: max.nutzerId, centProStunde: 4_500 },
        })
      ).status,
    ).toBe(201);
    await weber.anfrage(`${PZ}/projekte/${projekt.projektId}`, {
      method: "PATCH",
      body: { archiviert: true },
    });
    const archiviert = await weber.anfrage(`${PZ}/saetze`, {
      body: { projektId: projekt.projektId, centProStunde: 1, gueltigAb: "2026-02-01" },
    });
    expect(archiviert.status).toBe(409);
    expect(await json(archiviert)).toEqual({ fehler: "archiviert" });
  });

  it("shows and changes rates for owner and planner only", async () => {
    const { server, weber } = await weberMitAuftrag();
    const anna = await server.eingeladen(weber, "planer", "anna");
    expect((await anna.anfrage(`${PZ}/saetze`, { body: { centProStunde: 5_500 } })).status).toBe(
      201,
    );
    expect((await json(await anna.anfrage(`${PZ}/saetze`))).saetze).toHaveLength(1);
    for (const rolle of ["mitarbeiter", "lohnbuero", "betriebsrat", "extern"]) {
      const p = await server.eingeladen(weber, rolle, `p${rolle}`);
      expect((await p.anfrage(`${PZ}/saetze`)).status, rolle).toBe(403);
      expect((await p.anfrage(`${PZ}/saetze`, { body: { centProStunde: 1 } })).status, rolle).toBe(
        403,
      );
      expect(
        (await p.anfrage(`${PZ}/saetze/gilt?taetigkeitId=fahrt&nutzerId=x&tag=2026-11-20`)).status,
        rolle,
      ).toBe(403);
    }
  });

  it("asks for the activity, the person and a valid day", async () => {
    const { weber } = await weberMitAuftrag();
    for (const query of [
      "",
      "taetigkeitId=fahrt&tag=2026-11-20",
      "taetigkeitId=fahrt&nutzerId=x&tag=2026-13-01",
    ])
      expect((await weber.anfrage(`${PZ}/saetze/gilt?${query}`)).status, query).toBe(400);
  });
});
