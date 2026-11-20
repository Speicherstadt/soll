import { describe, expect, it } from "vitest";
import { anlegen, json, mitProjektzeit, PZ, weberMitAuftrag } from "./projektzeit-testhilfen.ts";

/** Weber with a customer, an order, an own activity and a rate; Mia's café beside it */
const zwei = async () => {
  const { server, weber, kunde, projekt } = await weberMitAuftrag();
  const montage = await anlegen(weber, "/taetigkeiten", { name: "Montage" });
  const satz = await anlegen(weber, "/saetze", {
    projektId: projekt.projektId,
    centProStunde: 7_500,
  });
  await weber.anfrage(`${PZ}/taetigkeiten/fahrt`, { method: "PATCH", body: { abrechenbar: true } });
  const mia = await mitProjektzeit(server, "Café Elbblick", "elbblick");
  return { weber, mia, kunde, projekt, montage, satz };
};

const unveraendert = async (weber: Awaited<ReturnType<typeof zwei>>["weber"]) => {
  expect((await json(await weber.anfrage(`${PZ}/kunden`))).kunden).toEqual([
    expect.objectContaining({ name: "Elbhof", archiviertAm: null }),
  ]);
  expect((await json(await weber.anfrage(`${PZ}/projekte`))).projekte).toEqual([
    expect.objectContaining({ name: "Bad Elbhof", archiviertAm: null }),
  ]);
  const taetigkeiten = (await json(await weber.anfrage(`${PZ}/taetigkeiten`))).taetigkeiten;
  expect(taetigkeiten).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ taetigkeitId: "fahrt", abrechenbar: true }),
      expect.objectContaining({ name: "Montage", archiviertAm: null }),
    ]),
  );
  expect((await json(await weber.anfrage(`${PZ}/saetze`))).saetze).toHaveLength(1);
};

describe("no business sees or changes another's project data", () => {
  it("GET /kunden, /projekte, /taetigkeiten and /saetze list one's own only", async () => {
    const { mia } = await zwei();
    expect((await json(await mia.anfrage(`${PZ}/kunden`))).kunden).toEqual([]);
    expect((await json(await mia.anfrage(`${PZ}/projekte`))).projekte).toEqual([]);
    const taetigkeiten = (await json(await mia.anfrage(`${PZ}/taetigkeiten`)))
      .taetigkeiten as unknown[];
    expect(taetigkeiten).toHaveLength(4);
    expect(taetigkeiten).toEqual(
      taetigkeiten.map(() => expect.objectContaining({ abrechenbar: false })),
    );
    expect((await json(await mia.anfrage(`${PZ}/saetze`))).saetze).toEqual([]);
  });

  it("PATCH and DELETE do not reach another's rows", async () => {
    const { weber, mia, kunde, projekt, montage, satz } = await zwei();
    for (const [pfad, body] of [
      [`/kunden/${kunde.kundeId}`, { archiviert: true }],
      [`/projekte/${projekt.projektId}`, { archiviert: true }],
      [`/taetigkeiten/${montage.taetigkeitId}`, { archiviert: true }],
    ] as const) {
      expect((await mia.anfrage(`${PZ}${pfad}`, { method: "PATCH", body })).status, pfad).toBe(404);
      expect((await mia.anfrage(`${PZ}${pfad}`, { method: "DELETE" })).status, pfad).toBe(404);
    }
    expect((await mia.anfrage(`${PZ}/saetze/${satz.satzId}`, { method: "DELETE" })).status).toBe(
      404,
    );
    // a fixed activity of one's own business is one's own row, not the other's
    expect(
      (
        await mia.anfrage(`${PZ}/taetigkeiten/fahrt`, {
          method: "PATCH",
          body: { abrechenbar: false },
        })
      ).status,
    ).toBe(200);
    await unveraendert(weber);
  });

  it("POST writes into one's own business and cannot name another's rows", async () => {
    const { weber, mia, kunde, projekt, montage } = await zwei();
    expect(
      (await mia.anfrage(`${PZ}/kunden`, { body: { name: "X", betriebId: weber.betriebId } }))
        .status,
    ).toBe(400);
    expect(
      (await mia.anfrage(`${PZ}/projekte`, { body: { kundeId: kunde.kundeId, name: "X" } })).status,
    ).toBe(422);
    for (const body of [
      { kundeId: kunde.kundeId, centProStunde: 1 },
      { projektId: projekt.projektId, centProStunde: 1 },
      { taetigkeitId: montage.taetigkeitId, centProStunde: 1 },
      { nutzerId: weber.nutzerId, centProStunde: 1 },
    ])
      expect((await mia.anfrage(`${PZ}/saetze`, { body })).status, JSON.stringify(body)).toBe(422);
    await unveraendert(weber);
  });

  it("GET /saetze/gilt reads one's own rates only", async () => {
    const { mia, projekt, montage, weber } = await zwei();
    const antwort = await mia.anfrage(
      `${PZ}/saetze/gilt?projektId=${projekt.projektId}&taetigkeitId=${montage.taetigkeitId}&nutzerId=${weber.nutzerId}&tag=2026-11-20`,
    );
    expect(antwort.status).toBe(422);
  });
});
