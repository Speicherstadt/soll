import { describe, expect, it } from "vitest";
import { type Json, json, weber } from "./monat-testhilfen.ts";

/** The person's personnel number and model surcharges (S-308) in the Auskunft (S-309) */
describe("GET /api/v1/auskunft with the DATEV export", () => {
  it("holds the person's personnel number and the surcharges of their model, in both copies", async () => {
    const w = await weber();
    const zuordnung = await w.jonas.anfrage("/api/v1/arbeitszeit/datev", {
      method: "PUT",
      body: {
        beraterNr: "1234567",
        mandantenNr: "12345",
        lohnarten: {},
        personalnummern: { [w.sandra.nutzerId]: "101", [w.anna.nutzerId]: "102" },
      },
    });
    expect(zuordnung.status).toBe(200);

    const eigen = await json(await w.sandra.anfrage("/api/v1/auskunft"));
    expect(eigen.personalnummer).toBe("101");
    expect(JSON.stringify(eigen)).not.toContain('"102"');
    expect(JSON.stringify(eigen)).not.toContain("1234567");
    const modell = (eigen.arbeitszeitmodelle as Json[])[0]?.modell as Json;
    expect(modell.zuschlagssaetze).toEqual({});
    const kette = eigen.auditKette as { zuDeinenDaten: Json[] };
    expect(kette.zuDeinenDaten.map((g) => g.tabelle)).toContain("datevPersonalnummern");

    // the owner sets the number in the DATEV settings, so his copy for Sandra holds it too
    const inhaber = await json(
      await w.jonas.anfrage(`/api/v1/auskunft?nutzerId=${w.sandra.nutzerId}`),
    );
    expect(inhaber.personalnummer).toBe("101");
  });

  it("names no personnel number where none is set", async () => {
    const w = await weber();
    expect((await json(await w.sandra.anfrage("/api/v1/auskunft"))).personalnummer).toBeNull();
  });
});
