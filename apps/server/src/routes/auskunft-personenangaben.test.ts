import { describe, expect, it } from "vitest";
import { type Json, json, weber } from "./monat-testhilfen.ts";

const ANGABEN = {
  geburtsdatum: "2009-03-14",
  wechselschicht: true,
  abruf: false,
  mutterschutz: [{ von: "2026-12-01", bis: null }],
};

/** What the rules need of a person (S-502) in the Auskunft under Art. 15 DSGVO (S-309) */
describe("GET /api/v1/auskunft with the data of a person", () => {
  it("holds the person's data for the rules, in the own copy and in the owner's", async () => {
    const w = await weber();
    const pfad = `/api/v1/personen/${w.sandra.nutzerId}/angaben`;
    expect((await w.jonas.anfrage(pfad, { method: "PUT", body: ANGABEN })).status).toBe(200);
    const fremd = `/api/v1/personen/${w.anna.nutzerId}/angaben`;
    expect(
      (await w.jonas.anfrage(fremd, { method: "PUT", body: { ...ANGABEN, abruf: true } })).status,
    ).toBe(200);

    const eigen = await json(await w.sandra.anfrage("/api/v1/auskunft"));
    expect(eigen.personenangaben).toEqual(expect.objectContaining(ANGABEN));
    expect(JSON.stringify(eigen.personenangaben)).not.toContain(w.anna.nutzerId);
    const kette = eigen.auditKette as { zuDeinenDaten: Json[] };
    expect(kette.zuDeinenDaten.map((g) => g.tabelle)).toContain("personenangaben");

    // the owner reads and writes them (personen:angaben), so his copy holds them too
    const inhaber = await json(
      await w.jonas.anfrage(`/api/v1/auskunft?nutzerId=${w.sandra.nutzerId}`),
    );
    expect(inhaber.personenangaben).toEqual(eigen.personenangaben);
  });

  it("holds null for a person without data for the rules", async () => {
    const w = await weber();
    const eigen = await json(await w.sandra.anfrage("/api/v1/auskunft"));
    expect(eigen.personenangaben).toBeNull();
  });
});
