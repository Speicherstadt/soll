import { describe, expect, it } from "vitest";
import {
  AL,
  DANACH,
  einstellen,
  json,
  MONAT,
  novemberBeiWeber,
  team,
  um,
} from "./auslastung-testhilfen.ts";
import { starten } from "./stoppuhr-testhilfen.ts";

const STUNDE = 3_600_000;

describe("auslastung: a stopwatch still running in an ended month", () => {
  it("does not change the team's numbers between two calls (review S-604)", async () => {
    const w = await novemberBeiWeber();
    w.server.stelleUhr(um("14:00"));
    const start = await starten(w.max, {
      projektId: w.projekt.projektId,
      taetigkeitId: w.montage.taetigkeitId,
    });
    expect(start.status).toBe(201);
    w.server.stelleUhr(DANACH);
    const erst = (await json(await team(w.weber))).team;
    w.server.stelleUhr(DANACH + STUNDE);
    const dann = (await json(await team(w.weber))).team;
    // docs/plan.md "Mindestgröße der Auslastung je Team": the difference between two calls would
    // show what one person did; a booking of an ended month still counting up shows the same
    expect(dann).toEqual(erst);
    // Sandra's 6 and Max's 4 billable hours, the running booking left out (docs/plan.md)
    expect(erst).toMatchObject({ abrechenbarMinuten: 600 });
  });
});

describe("auslastung while the module Projektzeit is off", () => {
  it("refuses every route with 403 modul_aus", async () => {
    const { weber } = await novemberBeiWeber();
    await einstellen(weber, true);
    const aus = await weber.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { projektzeit: false },
    });
    expect(aus.status).toBe(200);
    const antworten = [
      await weber.anfrage(`${AL}?monat=${MONAT}`),
      await weber.anfrage(`${AL}/personen?monat=${MONAT}`),
      await weber.anfrage(`${AL}/ich?monat=${MONAT}`),
      await einstellen(weber, true),
    ];
    for (const antwort of antworten) {
      expect(antwort.status).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "projektzeit" });
    }
  });
});
