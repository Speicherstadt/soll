import { describe, expect, it } from "vitest";
import {
  angelegt,
  genehmigt,
  type Json,
  json,
  krank,
  offen,
  schritt,
  um,
  weberMitAbwesenheiten,
} from "./abwesenheit-testhilfen.ts";
import { abschliessen, bestaetigen } from "./monat-testhilfen.ts";

/** Findings of the independent review of S-401 */
describe("S-401 review", () => {
  it("lets no colleague tell sickness from leave in the team calendar (Art. 9 DSGVO)", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, { von: "2026-11-23", bis: "2026-11-24" });
    await angelegt(krank(w.max));
    const team = await json(
      await w.sandra.anfrage(
        "/api/v1/arbeitszeit/abwesenheiten/team?von=2026-11-16&bis=2026-11-29",
      ),
    );
    const eintraege = team.abwesenheiten as Json[];
    const ohne = ({ abwesenheitId: _, nutzerId: __, name: ___, von: ____, ...rest }: Json) => rest;
    // a colleague learns who is away and until when, never whether it is sickness
    expect(eintraege.map(ohne)).toEqual([
      { art: "abwesend", bis: "2026-11-29", ersterHalb: false, letzterHalb: false },
      { art: "abwesend", bis: "2026-11-24", ersterHalb: false, letzterHalb: false },
    ]);
  });

  it("marks the certificate of a sickness reaching back into a closed month", async () => {
    const w = await weberMitAbwesenheiten();
    // Thursday 29 October: the certificate is due on Monday 2 November (§ 5 Abs. 1 Satz 2 EntgFG)
    w.server.stelleUhr(um("2026-10-29T08:00:00+01:00"));
    const id = await angelegt(krank(w.sandra));
    w.server.stelleUhr(um("2026-11-03T09:00:00+01:00"));
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    expect((await offen(w.jonas)).erinnerungen).toHaveLength(1);
    // the eAU is fetched: the reminder must go, the closed October stays as it was
    const antwort = await schritt(w.jonas, id, "bescheinigung", { bescheinigung: "eau" });
    expect(antwort.status, JSON.stringify(await json(antwort.clone()))).toBe(200);
    expect((await offen(w.jonas)).erinnerungen).toEqual([]);
  });

  it("takes a sickness report with an open end before later approved time off", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, {
      art: "sonderurlaub",
      von: "2026-12-10",
      bis: "2026-12-10",
    });
    // sick from today, the end not known yet: a day off in three weeks is no reason to refuse it
    const antwort = await krank(w.sandra);
    expect(antwort.status, JSON.stringify(await json(antwort.clone()))).toBe(201);
  });
});
