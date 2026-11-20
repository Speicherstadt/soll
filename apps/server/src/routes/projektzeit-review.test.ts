import { describe, expect, it } from "vitest";
import { json, PZ, weberMitAuftrag } from "./projektzeit-testhilfen.ts";

// Review of PR #31 (S-601)
describe("review of S-601", () => {
  it("refuses a rate for a device, which GET /saetze/personen does not offer", async () => {
    const { server, weber } = await weberMitAuftrag();
    const tablet = await server.eingeladen(weber, "geraet", "tablet");
    const satz = await weber.anfrage(`${PZ}/saetze`, {
      body: { nutzerId: tablet.nutzerId, centProStunde: 5_000 },
    });
    expect(satz.status).toBe(422);
    expect(await json(satz)).toEqual({ fehler: "person_unbekannt" });
  });

  it("gives an archived customer no new rate through one of its orders", async () => {
    const { weber, kunde, projekt } = await weberMitAuftrag();
    await weber.anfrage(`${PZ}/kunden/${kunde.kundeId}`, {
      method: "PATCH",
      body: { archiviert: true },
    });
    const satz = await weber.anfrage(`${PZ}/saetze`, {
      body: { projektId: projekt.projektId, centProStunde: 7_000 },
    });
    expect(satz.status).toBe(409);
    expect(await json(satz)).toEqual({ fehler: "archiviert" });
  });

  it("does not restore an order while its customer is archived", async () => {
    const { weber, kunde, projekt } = await weberMitAuftrag();
    const pfad = `${PZ}/projekte/${projekt.projektId}`;
    await weber.anfrage(pfad, { method: "PATCH", body: { archiviert: true } });
    await weber.anfrage(`${PZ}/kunden/${kunde.kundeId}`, {
      method: "PATCH",
      body: { archiviert: true },
    });
    const zurueck = await weber.anfrage(pfad, { method: "PATCH", body: { archiviert: false } });
    expect(zurueck.status).toBe(409);
    expect(await json(zurueck)).toEqual({ fehler: "archiviert" });
  });
});
