import { describe, expect, it } from "vitest";
import { monatStatus, pruefexportPerson, stundenzettelAus } from "../modules/arbeitszeit/index.ts";
import { JETZT, nachtrag, um } from "./monat-testhilfen.ts";
import {
  abends,
  einsatz,
  mitPlan,
  nachtragen,
  rufPlanen,
  summen,
} from "./rufbereitschaft-testhilfen.ts";

/*
 * Review S-505 (independent review, PR #73): a call-out that overlaps stamped work was counted twice
 * on the time sheet and in the Prüfexport, and a call-out joined to work stamped on the first of
 * the next month moved that work out of every month
 */

describe("review S-505: call-out overlapping stamped work", () => {
  it("the time sheet's day equals the Ist, not stamps plus call-out", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.sandra.nutzerId));
    for (const [art, zeit] of [
      ["kommen", "2026-11-19T20:00:00+01:00"],
      ["gehen", "2026-11-19T21:00:00+01:00"],
    ] as const)
      expect((await nachtrag(w.sandra, { art, zeitpunkt: um(zeit), grund: "Zettel" })).status).toBe(
        201,
      );
    const vorher = (await summen(w.sandra)).gearbeitetMinuten as number;
    // the same hour entered as a call-out too
    const antwort = await nachtragen(
      w.sandra,
      einsatz("2026-11-19T20:00:00+01:00", "2026-11-19T21:00:00+01:00"),
    );
    expect(antwort.status).toBe(201);
    // the month's Ist does not count the hour twice ...
    expect((await summen(w.sandra)).gearbeitetMinuten).toBe(vorher);
    // ... but the time sheet does
    const status = monatStatus(w.server.db, w.jonas.betriebId, w.sandra.nutzerId, "2026-11", JETZT);
    const zettel = stundenzettelAus(status, {
      betrieb: "Weber",
      person: "Sandra",
      name: () => "",
      pruefseite: "https://soll.test/pruefen",
      jetzt: JETZT,
    });
    const tag = zettel.tage.find((t) => t.tag === "2026-11-19");
    expect(tag?.arbeitsMinuten).toBe(60);
    // ... and the Prüfexport does not either
    const export_ = pruefexportPerson(w.server.db, w.jonas.betriebId, w.sandra.nutzerId, {
      von: "2026-11-19",
      bis: "2026-11-19",
      jetzt: JETZT,
      name: () => "",
      person: "Sandra",
    });
    expect(export_.tage.find((t) => t.tag === "2026-11-19")?.arbeitsMinuten).toBe(60);
  });
});

describe("review S-505: call-out at the end of a closed month", () => {
  it("work stamped on 1 November within 15 min after a call-out on 31 October counts in November", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.jonas.nutzerId, "2026-10-31"));
    expect(
      (await nachtragen(w.jonas, einsatz("2026-10-31T23:30:00+01:00", "2026-10-31T23:50:00+01:00")))
        .status,
    ).toBe(201);
    const ok = await w.jonas.anfrage("/api/v1/arbeitszeit/monat/bestaetigen", {
      body: { monat: "2026-10" },
    });
    expect(ok.status).toBe(201);
    const zu = await w.jonas.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-10", nutzerId: w.jonas.nutzerId },
    });
    expect(zu.status).toBe(201);
    const oktober = await summen(w.jonas, "2026-10", w.jonas.nutzerId);
    const vorher = (await summen(w.jonas, "2026-11", w.jonas.nutzerId)).gearbeitetMinuten as number;
    for (const [art, zeit] of [
      ["kommen", "2026-11-01T00:00:00+01:00"],
      ["gehen", "2026-11-01T08:00:00+01:00"],
    ] as const)
      expect((await nachtrag(w.jonas, { art, zeitpunkt: um(zeit), grund: "Zettel" })).status).toBe(
        201,
      );
    // October is closed and keeps its Ist
    expect(await summen(w.jonas, "2026-10", w.jonas.nutzerId)).toEqual(oktober);
    // so the 8 hours worked on 1 November must count in November
    const november = (await summen(w.jonas, "2026-11", w.jonas.nutzerId))
      .gearbeitetMinuten as number;
    expect(november - vorher).toBeGreaterThanOrEqual(480);
  });
});
