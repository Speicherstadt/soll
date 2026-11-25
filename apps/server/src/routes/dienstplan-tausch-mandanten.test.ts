import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";
import {
  anbieten,
  angeboten,
  elbblickZumTausch,
  schritt,
  TAUSCH,
  tauschbuchVon,
} from "./dienstplan-tausch-testhilfen.ts";
import { json, planen, schichtVon, veroeffentlichen } from "./dienstplan-testhilfen.ts";

/** Café Elbblick with an offer of Tom's, and Weber Haustechnik with its plan on the same server */
const zweiBetriebe = async () => {
  const server = testServer();
  const elbe = await elbblickZumTausch(server);
  const tausch = await angeboten(elbe.tom, elbe.schichtId);
  const jonas = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  await jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
  const werkstatt = await json(
    await jonas.anfrage("/api/v1/standorte", { body: { name: "Werkstatt", land: "HH" } }),
  );
  const sandra = await server.eingeladen(jonas, "mitarbeiter", "sandra");
  const eigene = await planen(jonas, schichtVon(werkstatt.standortId as string, sandra.nutzerId));
  await veroeffentlichen(jonas, werkstatt.standortId as string);
  return { ...elbe, tausch, jonas, sandra, sandraSchicht: eigene.schichtId as string };
};

describe("no business sees or changes another's swaps", () => {
  it("GET tausch lists nothing of the other business", async () => {
    const c = await zweiBetriebe();
    for (const wer of [c.jonas, c.sandra]) {
      const buch = await tauschbuchVon(wer);
      expect(buch.tausche).toEqual([]);
      expect(buch.kollegen.map((k) => k.name)).not.toContain("tom");
    }
  });

  it("POST tausch offers no shift of the other business, nor to its people", async () => {
    const c = await zweiBetriebe();
    expect((await anbieten(c.sandra, c.schichtId)).status).toBe(404);
    expect((await anbieten(c.jonas, c.schichtId)).status).toBe(404);
    const an = await anbieten(c.sandra, c.sandraSchicht, c.yusuf.nutzerId);
    expect([an.status, (await json(an)).fehler]).toEqual([404, "person_unbekannt"]);
  });

  it("no step reaches a swap of the other business", async () => {
    const c = await zweiBetriebe();
    for (const was of ["uebernehmen", "freigeben", "ablehnen"] as const) {
      const body = was === "ablehnen" ? { grund: "x" } : {};
      expect((await schritt(c.jonas, c.tausch.tauschId, was, body)).status, was).toBe(404);
    }
    expect((await schritt(c.sandra, c.tausch.tauschId, "uebernehmen")).status).toBe(404);
    const zurueck = await c.jonas.anfrage(`${TAUSCH}/${c.tausch.tauschId}`, { method: "DELETE" });
    expect(zurueck.status).toBe(404);
    expect((await tauschbuchVon(c.tom)).tausche).toEqual([
      expect.objectContaining({ tauschId: c.tausch.tauschId, status: "offen" }),
    ]);
  });

  it("PUT regel sets only the own business", async () => {
    const c = await zweiBetriebe();
    await c.jonas.anfrage(`${TAUSCH}/regel`, { method: "PUT", body: { ohneFreigabe: true } });
    expect((await tauschbuchVon(c.tom)).ohneFreigabe).toBe(false);
    expect((await tauschbuchVon(c.sandra)).ohneFreigabe).toBe(true);
  });
});

describe("the swap with the module Dienstplan switched off", () => {
  it("is refused, its data kept", async () => {
    const c = await zweiBetriebe();
    const module = (dienstplan: boolean) =>
      c.mia.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan } });
    await module(false);
    expect((await c.tom.anfrage(TAUSCH)).status).toBe(403);
    expect((await schritt(c.yusuf, c.tausch.tauschId, "uebernehmen")).status).toBe(403);
    await module(true);
    expect((await tauschbuchVon(c.tom)).tausche).toHaveLength(1);
  });

  it("is refused to external staff, who do not read the plan", async () => {
    const c = await zweiBetriebe();
    const extern = await c.server.eingeladen(c.mia, "extern", "jana");
    expect((await extern.anfrage(TAUSCH)).status).toBe(403);
    expect((await schritt(extern, c.tausch.tauschId, "uebernehmen")).status).toBe(403);
  });
});
