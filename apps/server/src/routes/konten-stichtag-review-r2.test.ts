import { describe, expect, it } from "vitest";
import { genehmigt, weberMitAbwesenheiten } from "./abwesenheit-testhilfen.ts";
import { anpassen, hinweis, type Json, json, konten, um } from "./konten-testhilfen.ts";

/* Review S-708 round 2: named leave partly taken after the notice, then leave added (EuGH C-684/16) */
describe("review S-708 r2", () => {
  it("lets expire only named leave still open: named 10, 4 taken after it, +4 by correction", async () => {
    const w = await weberMitAbwesenheiten();
    const h = await json(await hinweis(w.jonas, w.sandra, "2026-11-20"));
    expect(h.inhalt).toEqual([{ jahr: 2026, halbtage: 10, verfaelltAm: "2027-12-31" }]);
    await genehmigt(w, w.sandra, { von: "2026-12-21", bis: "2026-12-22" });
    w.server.stelleUhr(um("2026-12-23T09:00:00+01:00"));
    const korrektur = { art: "urlaub_korrektur", jahr: 2026, halbtage: 4 };
    expect((await anpassen(w.jonas, w.sandra, korrektur)).status).toBe(201);
    w.server.stelleUhr(um("2028-01-03T09:00:00+01:00"));
    const k = (await konten(w.sandra)).urlaub as Json;
    const topf2026 = (k.toepfe as Json[]).find((t) => t.jahr === 2026) as Json;
    // of the 10 named, 4 were taken: 6 named and open expire; the 4 added were never named
    expect(topf2026).toMatchObject({ verfallenHalbtage: 6, restHalbtage: 4 });
  });
});
