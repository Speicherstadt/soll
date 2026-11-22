import { describe, expect, it } from "vitest";
import { json, mitToken, tokenVon, weberMitSandra } from "./zugaenge-testhilfen.ts";

/** No business sees or revokes another's tokens, and a token never reaches another business */

const zweiBetriebe = async () => {
  const w = await weberMitSandra();
  const mia = await w.server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  return { ...w, mia };
};

describe("tokens and businesses", () => {
  it("GET /api/v1/zugaenge lists only the caller's own tokens in the caller's business", async () => {
    const { jonas, sandra, mia } = await zweiBetriebe();
    await tokenVon(sandra);
    await tokenVon(mia);
    expect(await json(await jonas.anfrage("/api/v1/zugaenge"))).toEqual({ zugaenge: [] });
    const vonMia = await json(await mia.anfrage("/api/v1/zugaenge"));
    expect(vonMia.zugaenge as unknown[]).toHaveLength(1);
  });

  it("DELETE /api/v1/zugaenge/:zugangId does not revoke another business's or person's token", async () => {
    const { server, jonas, sandra, mia } = await zweiBetriebe();
    const { token, zugang } = await tokenVon(sandra);
    for (const wer of [mia, jonas]) {
      const antwort = await wer.anfrage(`/api/v1/zugaenge/${zugang.zugangId}`, {
        method: "DELETE",
      });
      expect(antwort.status).toBe(404);
    }
    expect((await mitToken(server, token)("/api/v1/betrieb")).status).toBe(200);
  });

  it("POST /api/v1/zugaenge makes a token of the session's business only", async () => {
    const { server, mia } = await zweiBetriebe();
    const { token } = await tokenVon(mia);
    expect(await json(await mitToken(server, token)("/api/v1/betrieb"))).toMatchObject({
      name: "Café Elbblick",
    });
  });

  it("keeps a person in two businesses in the token's business, whatever her session chose", async () => {
    const { server, jonas, sandra, mia } = await zweiBetriebe();
    await server.auth.mitgliedHinzufuegen({
      nutzerId: sandra.nutzerId,
      betriebId: mia.betriebId,
      rolle: "mitarbeiter",
    });
    const { token } = await tokenVon(sandra);
    const wechsel = await sandra.anfrage("/api/auth/organization/set-active", {
      body: { organizationId: mia.betriebId },
    });
    expect(wechsel.status).toBe(200);
    expect(await json(await sandra.anfrage("/api/v1/betrieb"))).toMatchObject({
      name: "Café Elbblick",
    });
    const api = mitToken(server, token);
    expect(await json(await api("/api/v1/betrieb"))).toMatchObject({ name: "Weber Haustechnik" });
    // in Elbblick her list holds nothing of Weber's
    expect(await json(await sandra.anfrage("/api/v1/zugaenge"))).toEqual({ zugaenge: [] });
    expect(jonas.betriebId).not.toBe(mia.betriebId);
  });

  it("never shows another business's data on any GET of /api/v1", async () => {
    const { server, jonas, mia } = await zweiBetriebe();
    for (const modul of ["dienstplan", "projektzeit", "terminal"])
      await jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { [modul]: true } });
    const standort = await mia.anfrage("/api/v1/standorte", {
      body: { name: "Elbblick Ufer", land: "HH" },
    });
    expect(standort.status).toBe(201);
    const { token } = await tokenVon(jonas);
    const api = mitToken(server, token);
    const routen = [
      ...new Set(
        server.app.routes
          .filter(
            (r) => r.method === "GET" && r.path.startsWith("/api/v1/") && !r.path.includes(":"),
          )
          .map((r) => r.path),
      ),
    ];
    expect(routen.length).toBeGreaterThan(15);
    for (const pfad of routen) {
      const text = await (await api(pfad)).text();
      expect(text, pfad).not.toContain(mia.betriebId);
      expect(text, pfad).not.toContain("Elbblick");
    }
  });
});
