import { describe, expect, it } from "vitest";
import { json, PZ } from "./projektzeit-testhilfen.ts";
import { buchen, starten, um, werkstatt } from "./stoppuhr-testhilfen.ts";

type Projekt = { projektId: string; budget: unknown[] };

const budgetVon = async (person: Parameters<typeof buchen>[0], projektId: string) =>
  ((await json(await person.anfrage(`${PZ}/projekte`))).projekte as Projekt[]).find(
    (projekt) => projekt.projektId === projektId,
  )?.budget;

describe("bookings feed the budget of their order (S-601, S-602)", () => {
  it("counts booked minutes and the amount at the rate in force, with the warning", async () => {
    // "Bad Elbhof": 2 400 minutes and 4 000 €, warning from 80 %
    const { server, weber, sandra, projekt, montage } = await werkstatt();
    await weber.anfrage(`${PZ}/saetze`, {
      body: { projektId: projekt.projektId, centProStunde: 10_000, gueltigAb: "2026-11-01" },
    });
    expect(await budgetVon(weber, projekt.projektId)).toEqual([
      { art: "minuten", budget: 2_400, verbraucht: 0, rest: 2_400, stufe: "ok" },
      { art: "cent", budget: 400_000, verbraucht: 0, rest: 400_000, stufe: "ok" },
    ]);
    server.stelleUhr(um("23:59"));
    // 33 hours of Montage over two days, and one hour of not billed Fahrt on the order
    await buchen(sandra, {
      projektId: projekt.projektId,
      taetigkeitId: montage.taetigkeitId,
      beginn: um("00:00", "2026-11-19"),
      ende: um("18:00", "2026-11-19"),
    });
    await buchen(sandra, {
      projektId: projekt.projektId,
      taetigkeitId: montage.taetigkeitId,
      beginn: um("06:00"),
      ende: um("21:00"),
    });
    await buchen(sandra, {
      projektId: projekt.projektId,
      taetigkeitId: "fahrt",
      beginn: um("21:00"),
      ende: um("22:00"),
    });
    expect(await budgetVon(weber, projekt.projektId)).toEqual([
      { art: "minuten", budget: 2_400, verbraucht: 2_040, rest: 360, stufe: "warnung" },
      { art: "cent", budget: 400_000, verbraucht: 330_000, rest: 70_000, stufe: "warnung" },
    ]);
    // money only for whoever keeps the orders
    expect(await budgetVon(sandra, projekt.projektId)).toEqual([
      { art: "minuten", budget: 2_400, verbraucht: 2_040, rest: 360, stufe: "warnung" },
    ]);
    // a running stopwatch counts up to now: 6 more hours use the minutes up
    await starten(sandra, { projektId: projekt.projektId, taetigkeitId: montage.taetigkeitId });
    server.stelleUhr(um("05:59", "2026-11-21"));
    expect(await budgetVon(sandra, projekt.projektId)).toEqual([
      { art: "minuten", budget: 2_400, verbraucht: 2_400, rest: 0, stufe: "aufgebraucht" },
    ]);
  });
});

describe("what a booking names is archived instead of removed (S-601, S-602)", () => {
  it("refuses to remove an order or an own activity a booking names", async () => {
    const { server, weber, sandra, projekt, montage } = await werkstatt();
    const frei = await json(
      await weber.anfrage(`${PZ}/projekte`, { body: { kundeId: projekt.kundeId, name: "Leer" } }),
    );
    const tuer = await json(await weber.anfrage(`${PZ}/taetigkeiten`, { body: { name: "Tür" } }));
    server.stelleUhr(um("12:00"));
    await buchen(sandra, {
      projektId: String(frei.projektId),
      taetigkeitId: tuer.taetigkeitId,
      beginn: um("08:00"),
      ende: um("09:00"),
    });
    for (const pfad of [`/projekte/${frei.projektId}`, `/taetigkeiten/${tuer.taetigkeitId}`]) {
      const antwort = await weber.anfrage(`${PZ}${pfad}`, { method: "DELETE" });
      expect(antwort.status, pfad).toBe(409);
      expect(await json(antwort)).toEqual({ fehler: "verwendet" });
    }
    // without a booking (and a rate) they go
    expect(
      (await weber.anfrage(`${PZ}/taetigkeiten/${montage.taetigkeitId}`, { method: "DELETE" }))
        .status,
    ).toBe(204);
  });
});
