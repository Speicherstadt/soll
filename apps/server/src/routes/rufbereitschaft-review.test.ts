import { describe, expect, it } from "vitest";
import { monatStatus, pruefexportPerson, stundenzettelAus } from "../modules/arbeitszeit/index.ts";
import { JETZT, type Json, json, nachtrag, um } from "./monat-testhilfen.ts";
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

describe("review S-505, round 4: work joining a call-out of a closed month", () => {
  it("stamps on 1 November within 9 h after a call-out on a closed 31 October are refused", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.jonas.nutzerId, "2026-10-31"));
    expect(
      (await nachtragen(w.jonas, einsatz("2026-10-31T23:30:00+01:00", "2026-10-31T23:50:00+01:00")))
        .status,
    ).toBe(201);
    await w.jonas.anfrage("/api/v1/arbeitszeit/monat/bestaetigen", { body: { monat: "2026-10" } });
    const zu = await w.jonas.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-10", nutzerId: w.jonas.nutzerId },
    });
    expect(zu.status).toBe(201);
    const oktober = await summen(w.jonas, "2026-10", w.jonas.nutzerId);
    // the call-out is read as stamped (R-29): a Kommen under 9 h after it, open or not, continues
    // its shift of 31.10. and so the closed October, refused as any such stamp is (round 5)
    for (const zeit of ["2026-11-01T00:00:00+01:00", "2026-11-01T08:49:00+01:00"]) {
      const kommen = await nachtrag(w.jonas, {
        art: "kommen",
        zeitpunkt: um(zeit),
        grund: "Zettel",
      });
      expect({ zeit, status: kommen.status }).toEqual({ zeit, status: 409 });
    }
    expect(await summen(w.jonas, "2026-10", w.jonas.nutzerId)).toEqual(oktober);
    // from 9 h after the call-out on it is a shift of its own of 1.11. and counts in November
    const vorher = (await summen(w.jonas, "2026-11", w.jonas.nutzerId)).gearbeitetMinuten as number;
    for (const [art, zeit] of [
      ["kommen", "2026-11-01T08:50:00+01:00"],
      ["gehen", "2026-11-01T16:50:00+01:00"],
    ] as const)
      expect((await nachtrag(w.jonas, { art, zeitpunkt: um(zeit), grund: "Zettel" })).status).toBe(
        201,
      );
    const nachher = (await summen(w.jonas, "2026-11", w.jonas.nutzerId)).gearbeitetMinuten;
    expect(nachher).toBe(vorher + 480);
  });

  it("closing October waits until 9 h after a call-out at its end", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.jonas.nutzerId, "2026-10-31"));
    await nachtragen(w.jonas, einsatz("2026-10-31T23:30:00+01:00", "2026-10-31T23:50:00+01:00"));
    w.server.stelleUhr(um("2026-11-01T08:00:00+01:00"));
    await w.jonas.anfrage("/api/v1/arbeitszeit/monat/bestaetigen", { body: { monat: "2026-10" } });
    const zu = await w.jonas.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-10", nutzerId: w.jonas.nutzerId },
    });
    expect(zu.status).toBe(409);
    expect(await json(zu)).toMatchObject({ fehler: "schicht_kann_weiterlaufen" });
  });
});

describe("review S-505, round 4: a shift joined across the month's end belongs to its first day", () => {
  it("with October open, stamps on 1.11. join the call-out on 31.10.: October counts them and shows § 3", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.jonas.nutzerId, "2026-10-31"));
    await nachtragen(w.jonas, einsatz("2026-10-31T23:30:00+01:00", "2026-10-31T23:50:00+01:00"));
    const november = (await summen(w.jonas, "2026-11", w.jonas.nutzerId)).gearbeitetMinuten;
    for (const [art, zeit] of [
      ["kommen", "2026-11-01T00:00:00+01:00"],
      ["pause_beginn", "2026-11-01T05:00:00+01:00"],
      ["pause_ende", "2026-11-01T05:45:00+01:00"],
      ["gehen", "2026-11-01T10:40:00+01:00"],
    ] as const)
      expect((await nachtrag(w.jonas, { art, zeitpunkt: um(zeit), grund: "Zettel" })).status).toBe(
        201,
      );
    const oktober = await json(
      await w.jonas.anfrage(`/api/v1/arbeitszeit/monat?monat=2026-10&nutzerId=${w.jonas.nutzerId}`),
    );
    const inhalt = oktober.inhalt as Json;
    expect((inhalt.befunde as Json[]).map((b) => [b.regel, b.tage])).toContainEqual([
      "R-02",
      ["2026-10-31"],
    ]);
    const tag = (inhalt.tage as Json[]).find((t) => t.tag === "2026-10-31");
    expect(tag?.stempel).toHaveLength(4);
    // 20 min call-out, 10 min gap, 10:40 with 45 min break
    expect((inhalt.summen as Json).gearbeitetMinuten).toBe(20 + 10 + 640 - 45);
    expect((await summen(w.jonas, "2026-11", w.jonas.nutzerId)).gearbeitetMinuten).toBe(november);
  });
});

describe("review S-505, round 2: a call-out on the 1st of a shift of a closed last day", () => {
  it("is refused with monat_gesperrt, as a stamp would be", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.jonas.nutzerId, "2026-10-31"));
    for (const [art, zeit] of [
      ["kommen", "2026-10-31T18:00:00+01:00"],
      ["gehen", "2026-10-31T22:00:00+01:00"],
    ] as const)
      await nachtrag(w.jonas, { art, zeitpunkt: um(zeit), grund: "Zettel" });
    await w.jonas.anfrage("/api/v1/arbeitszeit/monat/bestaetigen", { body: { monat: "2026-10" } });
    await w.jonas.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-10", nutzerId: w.jonas.nutzerId },
    });
    const antwort = await nachtragen(
      w.jonas,
      einsatz("2026-11-01T01:00:00+01:00", "2026-11-01T02:00:00+01:00"),
    );
    expect(antwort.status).toBe(409);
    expect(await json(antwort)).toEqual({ fehler: "monat_gesperrt" });
  });
});
