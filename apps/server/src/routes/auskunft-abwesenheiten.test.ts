import { describe, expect, it } from "vitest";
import {
  angelegt,
  antrag,
  genehmigt,
  type Json,
  json,
  krank,
  schritt,
  weberMitAbwesenheiten,
} from "./abwesenheit-testhilfen.ts";

/** The person's absences (S-401) in the Auskunft under Art. 15 DSGVO (S-309) */
describe("GET /api/v1/auskunft with absences", () => {
  it("holds every absence of the person with its state, and none of another person", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, { von: "2026-12-21", bis: "2026-12-23" });
    const abgelehnt = await angelegt(
      antrag(w.sandra, { art: "urlaub", von: "2027-01-04", bis: "2027-01-05" }),
    );
    expect((await schritt(w.jonas, abgelehnt, "ablehnen", { grund: "Inventur" })).status).toBe(200);
    await angelegt(krank(w.sandra));
    await angelegt(krank(w.max));

    const eigen = await json(await w.sandra.anfrage("/api/v1/auskunft"));
    const abwesenheiten = eigen.abwesenheiten as Json[];
    expect(abwesenheiten).toHaveLength(3);
    expect(abwesenheiten).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ art: "urlaub", von: "2026-12-21", status: "genehmigt" }),
        expect.objectContaining({ art: "urlaub", status: "abgelehnt", grund: "Inventur" }),
        expect.objectContaining({ art: "krank", von: "2026-11-20", bis: null }),
      ]),
    );
    // who decided by name, as the person's stamps name who changed them; no id of another person
    const dezember = abwesenheiten.find((a) => a.von === "2026-12-21");
    expect(dezember).toMatchObject({
      entschiedenVon: "Inhaber Weber Haustechnik",
      erstelltVon: "sandra",
    });
    expect(JSON.stringify(abwesenheiten)).not.toContain(w.max.nutzerId);
    const kette = eigen.auditKette as { zuDeinenDaten: Json[] };
    expect(kette.zuDeinenDaten.map((g) => g.tabelle)).toContain("abwesenheiten");
  });

  it("is in the owner's copy, who sees every absence with its kind (abwesenheiten:gesundheit)", async () => {
    const w = await weberMitAbwesenheiten();
    await angelegt(krank(w.sandra));
    const eigen = await json(await w.sandra.anfrage("/api/v1/auskunft"));
    const inhaber = await json(
      await w.jonas.anfrage(`/api/v1/auskunft?nutzerId=${w.sandra.nutzerId}`),
    );
    expect(inhaber.abwesenheiten).toEqual(eigen.abwesenheiten);
    const kette = inhaber.auditKette as { zuDeinenDaten: Json[] };
    expect(kette.zuDeinenDaten.map((g) => g.tabelle)).toContain("abwesenheiten");
  });
});
