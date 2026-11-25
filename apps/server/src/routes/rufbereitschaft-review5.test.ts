import { describe, expect, it } from "vitest";
import { json, nachtrag, um } from "./monat-testhilfen.ts";
import { abends, EINSAETZE, mitPlan, rufPlanen, summen } from "./rufbereitschaft-testhilfen.ts";

/*
 * Review S-505, round 5: a call-out running when the month before is closed. A Kommen at the same
 * time continues the shift of 31.10. at once (R-01, gap under 9 h) and blocks closing October
 * ("offene_schicht"); a running call-out joins nothing until it ends, so October can be closed
 * while it runs, and its end would then change the closed October.
 */

const schichtAm31 = async (w: Awaited<ReturnType<typeof mitPlan>>) => {
  for (const [art, zeit] of [
    ["kommen", "2026-10-31T14:00:00+01:00"],
    ["gehen", "2026-10-31T22:00:00+01:00"],
  ] as const)
    expect((await nachtrag(w.jonas, { art, zeitpunkt: um(zeit), grund: "Zettel" })).status).toBe(
      201,
    );
};

const abschliessen = async (w: Awaited<ReturnType<typeof mitPlan>>) => {
  await w.jonas.anfrage("/api/v1/arbeitszeit/monat/bestaetigen", { body: { monat: "2026-10" } });
  return w.jonas.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
    body: { monat: "2026-10", nutzerId: w.jonas.nutzerId },
  });
};

describe("review S-505, round 5: a running call-out and closing the month before", () => {
  it("control (main): a Kommen at 1.11. 2:00 still open blocks closing October at 7:30", async () => {
    const w = await mitPlan();
    w.server.stelleUhr(um("2026-11-01T02:00:00+01:00"));
    await schichtAm31(w);
    expect(
      (
        await nachtrag(w.jonas, {
          art: "kommen",
          zeitpunkt: um("2026-11-01T02:00:00+01:00"),
          grund: "Zettel",
        })
      ).status,
    ).toBe(201);
    w.server.stelleUhr(um("2026-11-01T07:30:00+01:00"));
    expect((await abschliessen(w)).status).toBe(409);
  });

  it("a call-out begun live at 1.11. 2:00 can be ended at 8:00 and counts (§ 2 Abs. 1 ArbZG)", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.jonas.nutzerId, "2026-10-31"));
    w.server.stelleUhr(um("2026-11-01T02:00:00+01:00"));
    await schichtAm31(w);
    expect((await w.jonas.anfrage(`${EINSAETZE}/beginnen`, { body: {} })).status).toBe(201);
    w.server.stelleUhr(um("2026-11-01T07:30:00+01:00"));
    const zu = await abschliessen(w);
    w.server.stelleUhr(um("2026-11-01T08:00:00+01:00"));
    const ende = await w.jonas.anfrage(`${EINSAETZE}/beenden`, { body: {} });
    // either October may not be closed while the call-out runs (as with a Kommen) ...
    // ... or the call-out must still be endable; never both refused-to-end and closed
    expect({ abschluss: zu.status, beenden: ende.status, fehler: await json(ende) }).toEqual(
      zu.status === 201
        ? { abschluss: 201, beenden: 200, fehler: expect.anything() }
        : { abschluss: 409, beenden: 200, fehler: expect.anything() },
    );
    const okt = (await summen(w.jonas, "2026-10", w.jonas.nutzerId)).gearbeitetMinuten as number;
    const nov = (await summen(w.jonas, "2026-11", w.jonas.nutzerId)).gearbeitetMinuten as number;
    // 8 h stamped plus 6 h call-out are recorded somewhere
    expect(okt + nov).toBe(480 + 360);
  });
});
