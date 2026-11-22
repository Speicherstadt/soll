import { describe, expect, it } from "vitest";
import { ELBHOF, HB, liste, mitHaben, uebergeben } from "./haben-testhilfen.ts";
import { json, mitProjektzeit } from "./projektzeit-testhilfen.ts";

/** Weber with a Haben, linked and ready; Mia's café in the same instance without one */
const zwei = async () => {
  const w = await mitHaben();
  const mia = await mitProjektzeit(w.server, "Café Elbblick", "elbblick");
  return { ...w, mia };
};

describe("no business sees or uses another's link to Haben (S-606)", () => {
  it("GET /zugang shows one's own access only", async () => {
    const w = await zwei();
    expect(await json(await w.mia.anfrage(`${HB}/zugang`))).toEqual({ zugang: null });
  });

  it("PUT and DELETE /zugang change one's own access only", async () => {
    const w = await zwei();
    const gesetzt = await w.mia.anfrage(`${HB}/zugang`, {
      method: "PUT",
      body: { adresse: "https://haben.elbblick.test", token: "hb_mia" },
    });
    expect(gesetzt.status).toBe(200);
    expect((await w.mia.anfrage(`${HB}/zugang`, { method: "DELETE" })).status).toBe(204);
    expect((await w.mia.anfrage(`${HB}/zugang`, { method: "DELETE" })).status).toBe(404);
    const weber = (await json(await w.weber.anfrage(`${HB}/zugang`))).zugang;
    expect(weber).toMatchObject({ adresse: "https://haben.test", tokenGesetzt: true });
  });

  it("GET /kontakte never reads Haben with another business's token", async () => {
    const w = await zwei();
    const anfragen = w.haben.anfragen().length;
    expect((await w.mia.anfrage(`${HB}/kontakte`)).status).toBe(409);
    expect(w.haben.anfragen().length).toBe(anfragen);
  });

  it("POST /kontakte/{id} links no customer of another business", async () => {
    const w = await zwei();
    await w.mia.anfrage(`${HB}/zugang`, {
      method: "PUT",
      body: { adresse: w.haben.basis, token: w.haben.token },
    });
    const fremd = await w.mia.anfrage(`${HB}/kontakte/${ELBHOF}`, {
      body: { kundeId: w.kunde.kundeId },
    });
    expect(fremd.status).toBe(404);
    const kunden = (await json(await w.weber.anfrage("/api/v1/projektzeit/kunden"))).kunden;
    expect(kunden).toEqual([
      expect.objectContaining({ kundeId: w.kunde.kundeId, externId: ELBHOF }),
    ]);
  });

  it("GET /buchungen lists no order of another business", async () => {
    const w = await zwei();
    expect((await liste(w.mia, w.projekt.projektId)).status).toBe(422);
  });

  it("POST /uebergabe neither bills nor sends another business's bookings", async () => {
    const w = await zwei();
    await w.mia.anfrage(`${HB}/zugang`, {
      method: "PUT",
      body: { adresse: w.haben.basis, token: w.haben.token },
    });
    const antwort = await uebergeben(w.mia, [w.sandraMontage.buchungId]);
    expect(antwort.status).toBe(404);
    expect(w.haben.leistungen()).toEqual([]);
    const stand = (await json(await liste(w.weber, w.projekt.projektId))).buchungen as {
      stand: string;
    }[];
    expect(stand.every((b) => b.stand === "offen")).toBe(true);
  });
});
