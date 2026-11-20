import { describe, expect, it } from "vitest";
import { type Json, json, weber } from "./monat-testhilfen.ts";

/** The person's own hourly rates (S-601) in the Auskunft under Art. 15 DSGVO (S-309) */
describe("GET /api/v1/auskunft with project time", () => {
  it("holds the rates set for the person, not the business's or another person's", async () => {
    const w = await weber();
    await w.jonas.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { projektzeit: true },
    });
    const satz = async (body: Json) =>
      (await w.jonas.anfrage("/api/v1/projektzeit/saetze", { body })).status;
    expect(await satz({ nutzerId: w.sandra.nutzerId, centProStunde: 6_500 })).toBe(201);
    expect(await satz({ centProStunde: 7_900 })).toBe(201);
    expect(await satz({ nutzerId: w.anna.nutzerId, centProStunde: 5_500 })).toBe(201);

    const eigen = await json(await w.sandra.anfrage("/api/v1/auskunft"));
    expect(eigen.stundensaetze).toEqual([
      expect.objectContaining({ centProStunde: 6_500, kundeId: null, projektId: null }),
    ]);
    const kette = eigen.auditKette as { zuDeinenDaten: Json[] };
    expect(kette.zuDeinenDaten.map((g) => g.tabelle)).toContain("stundensaetze");

    // the owner sets and sees the rates (Sätze), so his copy for Sandra holds them too
    const inhaber = await json(
      await w.jonas.anfrage(`/api/v1/auskunft?nutzerId=${w.sandra.nutzerId}`),
    );
    expect(inhaber.stundensaetze).toEqual(eigen.stundensaetze);
  });

  it("holds the person's bookings of project time with the rate they were billed with", async () => {
    const w = await weber();
    await w.jonas.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { projektzeit: true },
    });
    const pz = "/api/v1/projektzeit";
    const eigene = await w.sandra.anfrage(`${pz}/stoppuhr/start`, {
      body: { projektId: null, taetigkeitId: "fahrt" },
    });
    expect(eigene.status).toBe(201);
    expect(
      (await w.anna.anfrage(`${pz}/stoppuhr/start`, { body: { taetigkeitId: "lager" } })).status,
    ).toBe(201);

    const eigen = await json(await w.sandra.anfrage("/api/v1/auskunft"));
    expect(eigen.projektzeiten).toEqual([
      expect.objectContaining({ taetigkeitId: "fahrt", ende: null, centProStunde: null }),
    ]);
    const kette = eigen.auditKette as { zuDeinenDaten: Json[] };
    expect(kette.zuDeinenDaten.map((g) => g.tabelle)).toContain("projektzeiten");
    // the owner sees and changes everyone's bookings, so his copy holds them too
    const inhaber = await json(
      await w.jonas.anfrage(`/api/v1/auskunft?nutzerId=${w.sandra.nutzerId}`),
    );
    expect(inhaber.projektzeiten).toEqual(eigen.projektzeiten);
  });
});
