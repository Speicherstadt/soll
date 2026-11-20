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
});
