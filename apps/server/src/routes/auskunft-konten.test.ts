import { describe, expect, it } from "vitest";
import { weberMitAbwesenheiten } from "./abwesenheit-testhilfen.ts";
import { anpassen, hinweis, type Json, json } from "./konten-testhilfen.ts";

/* The accounts in the Auskunft under Art. 15 DSGVO (S-402) */
describe("Auskunft: the person's accounts", () => {
  it("holds the changes by hand and the notices with what they named, and their links", async () => {
    const w = await weberMitAbwesenheiten();
    expect((await hinweis(w.jonas, w.sandra, "2026-11-20")).status).toBe(201);
    expect(
      (await anpassen(w.jonas, w.sandra, { art: "startsaldo", monat: "2026-10", minuten: 60 }))
        .status,
    ).toBe(201);
    const eigen = await json(await w.sandra.anfrage("/api/v1/auskunft"));
    expect((eigen.urlaubshinweise as Json[]).map((h) => [h.tag, h.inhalt, h.erstelltVon])).toEqual([
      [
        "2026-11-20",
        [{ jahr: 2026, halbtage: 10, verfaelltAm: "2027-12-31" }],
        "Inhaber Weber Haustechnik",
      ],
    ]);
    expect((eigen.kontoAnpassungen as Json[]).map((a) => [a.art, a.minuten, a.grund])).toEqual([
      ["startsaldo", 60, "Übernahme"],
    ]);
    const kette = eigen.auditKette as { zuDeinenDaten: Json[] };
    const tabellen = kette.zuDeinenDaten.map((g) => g.tabelle);
    expect(tabellen).toContain("urlaubshinweise");
    expect(tabellen).toContain("kontoAnpassungen");

    const inhaber = await json(
      await w.jonas.anfrage(`/api/v1/auskunft?nutzerId=${w.sandra.nutzerId}`),
    );
    expect(inhaber.urlaubshinweise).toEqual(eigen.urlaubshinweise);
    expect(inhaber.kontoAnpassungen).toEqual(eigen.kontoAnpassungen);
    const max = await json(await w.max.anfrage("/api/v1/auskunft"));
    expect(max).toMatchObject({ urlaubshinweise: [], kontoAnpassungen: [] });
  });
});
